// Server/maintenance code only. No component or visitor request imports this.
import { z } from "zod/v3";
import {
  articleMappings,
  compareReadership,
  readershipSuccessSchema,
  readershipWindow,
  type InterestSnapshot,
  type ReadershipSuccess,
} from "./discovery-interest";

export class WikimediaUnavailable extends Error {
  constructor(
    message: string,
    public retryAt: string | null = null,
  ) {
    super(message);
  }
}
const defaultAgent =
  "LakbayDiscoveryBot/1.0 (https://lakbay-travel-journal.m1st021.chatgpt.site/discover)";
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export function createWikimediaClient(
  options: {
    fetcher?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    now?: () => Date;
    userAgent?: string;
    gapMs?: number;
    maxRequests?: number;
  } = {},
) {
  const fetcher = options.fetcher || fetch,
    sleep = options.sleep || wait;
  const now = options.now || (() => new Date());
  const userAgent = options.userAgent || defaultAgent;
  if (!/^[\w-]+\/[\w.]+.*\((?:https?:\/\/|[^)]*@)/.test(userAgent))
    throw new Error(
      "Set an identifying Wikimedia User-Agent with a website or contact address.",
    );
  let requests = 0;
  return {
    async get(url: string): Promise<unknown> {
      // Only documented, fixed hosts; never fetch a submitted social/source URL.
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        !["en.wikipedia.org", "wikimedia.org"].includes(parsed.hostname)
      )
        throw new Error("Unapproved provider host.");
      for (let attempt = 0; attempt < 2; attempt++) {
        if (++requests > (options.maxRequests ?? 24))
          throw new WikimediaUnavailable("Refresh request limit reached.");
        await sleep(options.gapMs ?? 400);
        let response: Response;
        try {
          response = await fetcher(url, {
            headers: {
              "User-Agent": userAgent,
              "Api-User-Agent": userAgent,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(8000),
          });
        } catch {
          throw new WikimediaUnavailable(
            "Wikimedia request timed out or could not connect.",
          );
        }
        if (response.status === 429 || response.status === 503) {
          const retry = response.headers.get("Retry-After");
          const delay =
            retry && /^\d+$/.test(retry)
              ? Number(retry) * 1000
              : retry && !Number.isNaN(Date.parse(retry))
                ? Math.max(0, Date.parse(retry) - now().getTime())
                : 5000;
          if (attempt === 0 && delay <= 5000) {
            await sleep(delay);
            continue;
          }
          throw new WikimediaUnavailable(
            "Wikimedia rate limited or postponed the refresh.",
            new Date(now().getTime() + Math.max(5000, delay)).toISOString(),
          );
        }
        if (response.status === 404)
          throw new WikimediaUnavailable(
            "Article or daily pageview data unavailable.",
          );
        if (!response.ok)
          throw new WikimediaUnavailable(
            `Wikimedia request unavailable (HTTP ${response.status}).`,
          );
        try {
          return await response.json();
        } catch {
          throw new WikimediaUnavailable("Wikimedia returned unreadable data.");
        }
      }
      throw new WikimediaUnavailable("Wikimedia retry limit reached.");
    },
  };
}
type Client = ReturnType<typeof createWikimediaClient>;
const resolvedArticleSchema = z.object({
  error: z.unknown().optional(),
  query: z
    .object({
      pages: z.array(
        z.object({
          pageid: z.number().int().positive().optional(),
          ns: z.number().optional(),
          title: z.string(),
          missing: z.boolean().optional(),
          pageprops: z.record(z.unknown()).optional(),
        }),
      ),
    })
    .optional(),
});
export async function resolveArticle(client: Client, expectedTitle: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageprops",
    titles: expectedTitle,
    maxlag: "5",
  });
  const result = resolvedArticleSchema.safeParse(
    await client.get(`https://en.wikipedia.org/w/api.php?${params}`),
  );
  const pages = result.success ? result.data.query?.pages : undefined;
  const page = pages?.[0];
  if (
    !result.success ||
    result.data.error ||
    pages?.length !== 1 ||
    !page?.pageid ||
    page.missing ||
    page.ns !== 0 ||
    (page.pageprops && "disambiguation" in page.pageprops) ||
    page.title !== expectedTitle
  )
    throw new WikimediaUnavailable(
      "Article missing, ambiguous, or redirected outside its reviewed mapping.",
    );
  return { title: page.title, pageId: page.pageid };
}
const pageviewsSchema = z.object({
  items: z.array(
    z.object({
      project: z.literal("en.wikipedia"),
      access: z.literal("all-access"),
      agent: z.literal("user"),
      granularity: z.literal("daily"),
      article: z.string(),
      timestamp: z.string().regex(/^\d{10}$/),
      views: z.number().int().nonnegative(),
    }),
  ),
});
export async function fetchReadership(
  client: Client,
  title: string,
  now = new Date(),
): Promise<ReadershipSuccess> {
  const article = await resolveArticle(client, title);
  const period = readershipWindow(now);
  const compact = (d: string) => d.replaceAll("-", "") + "00";
  const sourceUrl = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(article.title.replaceAll(" ", "_"))}/daily/${compact(period.start)}/${compact(period.end)}`;
  const parsed = pageviewsSchema.safeParse(await client.get(sourceUrl));
  if (!parsed.success)
    throw new WikimediaUnavailable(
      "Daily pageviews are missing or unreadable.",
    );
  const days = parsed.data.items.map((d) => {
    if (d.article.replaceAll("_", " ") !== title || !d.timestamp.endsWith("00"))
      throw new WikimediaUnavailable(
        "Pageviews do not match the reviewed article or daily resolution.",
      );
    return {
      date: `${d.timestamp.slice(0, 4)}-${d.timestamp.slice(4, 6)}-${d.timestamp.slice(6, 8)}`,
      views: d.views,
    };
  });
  const result = readershipSuccessSchema.safeParse({
    ...article,
    ...period,
    project: "en.wikipedia.org",
    agent: "user",
    access: "all-access",
    sourceUrl,
    fetchedAt: now.toISOString(),
    days,
  });
  if (!result.success || !compareReadership(result.data))
    throw new WikimediaUnavailable(
      "The complete fourteen-day coverage is not available. Missing days are not zero interest.",
    );
  return result.data;
}
export async function refreshInterest(
  previous: InterestSnapshot,
  client: Client,
  now = new Date(),
  force = false,
) {
  if (previous.retryAfter && Date.parse(previous.retryAfter) > now.getTime())
    return previous;
  if (
    !force &&
    previous.lastAttemptAt &&
    Date.parse(previous.lastAttemptAt) + 86400000 > now.getTime()
  )
    return previous;
  const next = structuredClone(previous);
  next.lastAttemptAt = now.toISOString();
  next.retryAfter = null;
  for (const mapping of articleMappings) {
    try {
      const lastSuccess = await fetchReadership(client, mapping.title, now);
      next.records[mapping.placeId] = { lastSuccess, error: null };
      next.updatedAt = now.toISOString();
    } catch (error) {
      const issue =
        error instanceof WikimediaUnavailable
          ? error
          : new WikimediaUnavailable("Readership refresh unavailable.");
      next.records[mapping.placeId] = {
        lastSuccess: next.records[mapping.placeId]?.lastSuccess || null,
        error: issue.message,
      };
      if (issue.retryAt) {
        next.retryAfter = issue.retryAt;
        break;
      }
    }
  }
  return next;
}

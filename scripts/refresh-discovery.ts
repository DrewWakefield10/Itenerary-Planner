// Run locally; the checked-in snapshot is deployed with the app, never written
// by a serverless request. No credentials, subscription, or billing required.
import { readFile, writeFile, rename } from "node:fs/promises";
import {
  interestSnapshotSchema,
  interestThresholdSchema,
} from "../lib/discovery-interest";
import {
  createWikimediaClient,
  refreshInterest,
} from "../lib/wikimedia-pageviews";
const path = new URL(
  "../lib/discovery-interest-snapshot.json",
  import.meta.url,
);
const previous = interestSnapshotSchema.parse(
  JSON.parse(await readFile(path, "utf8")),
);
const thresholds = interestThresholdSchema.parse({
  baseline: Number(
    process.env.DISCOVER_MIN_BASELINE || previous.thresholds.baseline,
  ),
  absoluteGrowth: Number(
    process.env.DISCOVER_MIN_GROWTH || previous.thresholds.absoluteGrowth,
  ),
  percentGrowth: Number(
    process.env.DISCOVER_MIN_PERCENT || previous.thresholds.percentGrowth,
  ),
  freshnessHours: Number(
    process.env.DISCOVER_FRESHNESS_HOURS || previous.thresholds.freshnessHours,
  ),
});
const next = await refreshInterest(
  previous,
  createWikimediaClient({ userAgent: process.env.WIKIMEDIA_USER_AGENT }),
  new Date(),
  process.argv.includes("--force"),
);
if (next === previous) {
  console.log(
    "Snapshot unchanged: daily refresh limit or upstream Retry-After remains active.",
  );
} else {
  next.thresholds = thresholds;
  const temp = new URL(
    "../lib/discovery-interest-snapshot.json.tmp",
    import.meta.url,
  );
  await writeFile(
    temp,
    JSON.stringify(interestSnapshotSchema.parse(next), null, 2) + "\n",
    "utf8",
  );
  await rename(temp, path);
  console.log(
    `Attempted ${next.lastAttemptAt}; last success ${next.updatedAt || "none"}.`,
  );
  for (const [id, entry] of Object.entries(next.records))
    console.log(`${id}: ${entry.error || "complete human-reader data"}`);
}

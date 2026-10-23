import { destination } from "./destinations";
import {
  defaultRequest,
  requestSchema,
  tomorrow,
  type TripRequest,
} from "./trip";
export type PlannerPrefill = { destinations?: string[]; days?: number };
export function clearPlannerPrefillQuery(query: string) {
  const params = new URLSearchParams(query);
  params.delete("destinations");
  params.delete("days");
  // Native history is synchronous and integrates with both supported routers.
  // Consume the request before a refresh can replay an already accepted choice.
  window.history.replaceState(
    null,
    "",
    "/planner" + (params.size ? "?" + params : "") + window.location.hash,
  );
}
export function readPlannerDraft(): unknown {
  try {
    const raw = window.localStorage.getItem("lakbay:draft");
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return undefined;
  }
}
export function readPlannerPrefill(query: string): PlannerPrefill {
  const params = new URLSearchParams(query),
    picks = params.get("destinations")?.split(",");
  const destinations =
    picks?.length &&
    picks.length <= 3 &&
    new Set(picks).size === picks.length &&
    picks.every((s) => !!destination(s))
      ? picks
      : undefined;
  const days = Number(params.get("days"));
  return {
    ...(destinations ? { destinations } : {}),
    ...(Number.isInteger(days) && days >= 2 && days <= 21 ? { days } : {}),
  };
}
export function applyPlannerPrefill(
  current: TripRequest,
  prefill: PlannerPrefill,
  mode: "replace" | "add",
  useDays = false,
) {
  const destinations = prefill.destinations
    ? mode === "add"
      ? [...new Set([...current.destinations, ...prefill.destinations])]
      : prefill.destinations
    : current.destinations;
  return requestSchema.parse({
    ...current,
    destinations,
    ...(useDays && prefill.days ? { days: prefill.days } : {}),
  });
}
export function plannerEntry(
  rawDraft: unknown,
  query: string,
  preferredPace: unknown = "Balanced",
) {
  const fallback = {
    ...defaultRequest,
    startDate: tomorrow(),
    pace: preferredPace,
  };
  const saved =
    rawDraft && typeof rawDraft === "object" && !Array.isArray(rawDraft)
      ? rawDraft
      : {};
  const parsed = requestSchema.safeParse({ ...fallback, ...saved });
  const request = parsed.success
    ? parsed.data
    : requestSchema.parse({ ...defaultRequest, startDate: tomorrow() });
  const draftValid =
    rawDraft === null ||
    (parsed.success &&
      rawDraft !== undefined &&
      typeof rawDraft === "object" &&
      !Array.isArray(rawDraft));
  const prefill = readPlannerPrefill(query);
  const differs =
    (prefill.destinations &&
      JSON.stringify(prefill.destinations) !==
        JSON.stringify(request.destinations)) ||
    (prefill.days && prefill.days !== request.days);
  if (rawDraft !== null)
    return { request, draftValid, proposal: differs ? prefill : null };
  const candidate = requestSchema.safeParse({ ...request, ...prefill });
  return {
    request: candidate.success ? candidate.data : request,
    draftValid: true,
    proposal: null,
  };
}

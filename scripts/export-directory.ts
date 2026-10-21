import { mkdir, writeFile } from "node:fs/promises";
import {
  directoryCandidates,
  directoryListings,
  directoryTargets,
  destinationGroups,
} from "../lib/catalog/directory";
import { directoryCandidateSchema } from "../lib/catalog/directory-schema";
import { destination, selectableDestinations } from "../lib/destinations";
import { discoveryPlace } from "../lib/discovery";
import { normalizePlaceName } from "../lib/catalog/identity";

const ids = new Set<string>(),
  names = new Set<string>();
const snapshotDate = new Date();
const generatedOn = snapshotDate.toLocaleDateString("en-CA", {
  timeZone: "Asia/Manila",
});
const generatedLabel = snapshotDate.toLocaleDateString("en-GB", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "long",
  year: "numeric",
});
for (const p of directoryCandidates) {
  directoryCandidateSchema.parse(p);
  if (ids.has(p.id)) throw new Error(`Duplicate candidate ID: ${p.id}`);
  ids.add(p.id);
  if (p.status === "accepted") {
    const key = `${p.destination_group}:${normalizePlaceName(p.name)}`;
    if (names.has(key)) throw new Error(`Duplicate accepted place: ${p.name}`);
    names.add(key);
    if (
      p.catalog_stop_id &&
      !selectableDestinations.some((d) =>
        d.stops.some((s) => s.id === p.catalog_stop_id),
      )
    )
      throw new Error(`Invalid stop mapping: ${p.id} -> ${p.catalog_stop_id}`);
  }
}
const accepted = directoryListings.map((p) => {
  const stop = selectableDestinations
    .flatMap((d) => d.stops)
    .find((s) => s.id === p.catalog_stop_id);
  return {
    ...p,
    image: discoveryPlace(p.id)?.image || null,
    practical: stop
      ? {
          estimated_visit_minutes: stop.minutes,
          entry_price: stop.entryPrice,
          opening_hours: stop.openingHours || null,
          booking: stop.booking,
          transport: stop.transport,
          accessibility: stop.accessibility,
          visit_mode: stop.mode,
          budget_allowance: stop.cost,
          budget_allowance_unit: stop.costBasis,
          cluster: stop.cluster,
          disruption_sensitivities: stop.disruptionSensitivities || [],
          sources: stop.sources,
        }
      : null,
  };
});
const progress = destinationGroups.map((group) => {
  const rows = directoryCandidates.filter((p) => p.destination_group === group);
  const count = (status: string) =>
    rows.filter((p) => p.status === status).length;
  return {
    destination: group,
    target: directoryTargets[group],
    researched: rows.length,
    accepted: count("accepted"),
    rejected: count("rejected"),
    unresolved: count("unresolved"),
    shortfall: Math.max(0, directoryTargets[group] - count("accepted")),
    batches: Math.ceil(rows.length / 25),
  };
});
await mkdir("public/data/research-batches", { recursive: true });
const json = (p: string, value: unknown) =>
  writeFile(p, JSON.stringify(value, null, 2) + "\n", "utf8");
await json("public/data/lakbay-candidates.json", directoryCandidates);
await json("public/data/lakbay-locations.json", accepted);
await json("public/data/research-progress.json", {
  generated_on: generatedOn,
  scope:
    "11 browsing destinations; identity and municipality acceptance does not verify operating details",
  totals: {
    target: 200,
    researched: directoryCandidates.length,
    accepted: accepted.length,
    rejected: directoryCandidates.filter((p) => p.status === "rejected").length,
    unresolved: directoryCandidates.filter((p) => p.status === "unresolved")
      .length,
  },
  destinations: progress,
});
for (const group of destinationGroups) {
  const rows = directoryCandidates.filter((p) => p.destination_group === group);
  for (let n = 0; n < rows.length; n += 25)
    await json(
      `public/data/research-batches/${group.toLowerCase()}-${String(n / 25 + 1).padStart(2, "0")}.json`,
      {
        destination: group,
        batch: n / 25 + 1,
        kind: "Export snapshot of reviewed candidate batch",
        entries: rows.slice(n, n + 25),
      },
    );
}
const columns = [
  "id",
  "name",
  "destination_group",
  "region",
  "province",
  "city_municipality",
  "barangay",
  "address",
  "latitude",
  "longitude",
  "category",
  "description",
  "itinerary_base_slug",
  "catalog_stop_id",
  "reviewed_on",
  "sources",
  "practical",
  "image",
] as const;
const csvCell = (v: unknown) =>
  `"${(v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll('"', '""')}"`;
await writeFile(
  "public/data/lakbay-locations.csv",
  "\uFEFF" +
    [
      columns.join(","),
      ...accepted.map((p) => columns.map((k) => csvCell(p[k])).join(",")),
    ].join("\r\n") +
    "\r\n",
  "utf8",
);
await mkdir("docs", { recursive: true });
await writeFile(
  "docs/directory-progress.md",
  [
    "# Directory research progress",
    "",
    `Snapshot: ${generatedLabel}. Each candidate has an explicit accepted, rejected, or unresolved decision. Acceptance means reviewed identity and municipality; it does not establish current access, admission, hours, or safety.`,
    "",
    "| Destination | Target | Researched | Accepted | Rejected | Unresolved | Shortfall |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...progress.map(
      (p) =>
        `| ${p.destination} | ${p.target} | ${p.researched} | ${p.accepted} | ${p.rejected} | ${p.unresolved} | ${p.shortfall} |`,
    ),
    "",
    `Total: ${directoryCandidates.length} candidates, ${accepted.length} accepted locations.`,
    "",
    "The combined source export is `public/data/lakbay-candidates.json`; accepted records are in `lakbay-locations.json` and `.csv`. Destination-grouped export snapshots have at most 25 records per file in `public/data/research-batches`. Incremental research-save history and source notes are in directory-luzon.md, directory-visayas.md and directory-islands.md.",
    "",
    "Structural validation and tests do not perform factual verification. Null values remain unknown. Existing source dates are retained unless the source was reviewed again. No generic meal breaks, tour packages, duplicate beach access points, or rejected candidates count toward accepted totals.",
    "",
  ].join("\n"),
  "utf8",
);
console.table(progress);
console.log(
  `Exported ${accepted.length} accepted locations from ${directoryCandidates.length} candidates.`,
);

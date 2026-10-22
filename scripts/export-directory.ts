import {directoryDetails} from "../lib/catalog/directory-details";
import {createHash} from "node:crypto";
import baseline from "../lib/catalog/expansion-baseline.json";
import {stableDirectoryJson} from "../lib/catalog/directory-import";
import { mkdir, writeFile } from "node:fs/promises";
import {
  directoryCandidates,
  directoryListings,
  directoryTargets,
  destinationGroups,
} from "../lib/catalog/directory";
import { directoryCandidateSchema } from "../lib/catalog/directory-schema";
import { selectableDestinations } from "../lib/destinations";
import { discoveryPlace } from "../lib/discovery";
import {placeContent,placeContents,videosForPlace} from "../lib/catalog/place-content";
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
const baselineIds=new Set(baseline.records.map(p=>p.id));
for(const original of baseline.records){
  const current=directoryListings.find(p=>p.id===original.id);
  if(!current||createHash("sha256").update(stableDirectoryJson(current)).digest("hex")!==original.record_sha256)throw new Error(`Original published record changed: ${original.id}`);
}
const accepted = directoryListings.map((p) => {
  const stop = selectableDestinations
    .flatMap((d) => d.stops)
    .find((s) => s.id === p.catalog_stop_id) || directoryDetails(p);
  return {
    ...p,
    slug:p.slug||p.id,
    aliases:p.aliases||[],
    image: discoveryPlace(p.id)?.image || null,
    card_summary:placeContent(p.id)?.summary||p.description,
    overview:placeContent(p.id)?.overview||[],
    highlights:placeContent(p.id)?.highlights||[],
    visiting_tips:placeContent(p.id)?.tips||[],
    content_sources:placeContent(p.id)?.sources||[],
    videos:videosForPlace(p.id),
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
          cluster: "cluster" in stop ? stop.cluster : p.planning?.cluster || null,
          disruption_sensitivities: "disruptionSensitivities" in stop ? stop.disruptionSensitivities || [] : p.planning?.disruptionSensitivities || [],
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
await writeFile("public/place-image-credits.txt", [
  "Lakbay place photographs — source, creator and reuse rights",
  "Optimized copies preserve the original license. Resized and JPEG compressed; card crops are presentation only.",
  "Existing photographs outside this editorial overlay retain their credits in /image-credits.txt.",
  "",
  ...placeContents.filter(p=>p.photo).flatMap(p=>[
    p.placeId, p.photo!.attribution,
    `Source: ${p.photo!.sourcePage}`, `Original: ${p.photo!.originalUrl}`,
    `License: ${p.photo!.licenseUrl}`, `Alt: ${p.photo!.alt}`, "",
  ]),
].join("\n"), "utf8");
await json("public/data/research-progress.json", {
  generated_on: generatedOn,
  scope:
    "11 browsing destinations; identity and municipality acceptance does not verify operating details",
  totals: {
    target: Object.values(directoryTargets).reduce((sum,n)=>sum+n,0),
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
  "slug",
  "aliases",
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
  "card_summary",
  "overview",
  "highlights",
  "visiting_tips",
  "content_sources",
  "videos",
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
const additions=accepted.filter(p=>!baselineIds.has(p.id));
const expansionProgress=destinationGroups.map(group=>({destination:group,starting:baseline.starting_by_destination[group],added:additions.filter(p=>p.destination_group===group).length,targetAdditions:directoryTargets[group]-baseline.starting_by_destination[group],final:accepted.filter(p=>p.destination_group===group).length}));
const categoryCounts=Object.fromEntries([...new Set(additions.map(p=>p.category))].sort().map(category=>[category,additions.filter(p=>p.category===category).length]));
await json("public/data/lakbay-additions.json",additions);
await json("public/data/expansion-progress.json",{generated_on:generatedOn,starting_count:baseline.starting_count,target_additions:150,accepted_additions:additions.length,remaining:Math.max(0,150-additions.length),final_unique_count:accepted.length,by_destination:expansionProgress,by_category:categoryCounts});
await writeFile("public/data/lakbay-additions.csv","\uFEFF"+[columns.join(","),...additions.map(p=>columns.map(k=>csvCell(p[k])).join(","))].join("\r\n")+"\r\n","utf8");
await writeFile("docs/expansion-progress.md",[
  "# Additional-place research progress","",`Snapshot: ${generatedLabel}. Starting directory: ${baseline.starting_count} unique accepted places. Additional accepted identities: ${additions.length}; final published count: ${accepted.length}. Remaining toward 150 additions: ${Math.max(0,150-additions.length)}.`,"",
  "| Destination | Starting | Added | Addition target | Final |","| --- | ---: | ---: | ---: | ---: |",...expansionProgress.map(p=>`| ${p.destination} | ${p.starting} | ${p.added} | ${p.targetAdditions} | ${p.final} |`),"",
  "| Added category | Count |","| --- | ---: |",...Object.entries(categoryCounts).map(([category,count])=>`| ${category} | ${count} |`),"",
  "Original 200 IDs and source records are checked against the immutable expansion baseline. Previously researched editorial-surplus candidates are promoted under their existing IDs; they are counted once as newly published locations. Source review dates are retained unless the source was reviewed again. Per-fact verification does not imply current opening, admission, reservations or access.","",
  "Research batches and factual decisions: expansion-islands.md, expansion-visayas.md, expansion-luzon.md. The atomic import checks normalized names, aliases, verified addresses and coordinate proximity before writing the approved batch. Rerunning identical input leaves the approved records unchanged.","",
  "Pending research from the interrupted expansion: Sagada 10, Iloilo 4 and Davao 4 additional verified places. The earlier research agents stopped at the usage limit before these batches were saved. The active task is now itinerary selection; no unreviewed candidates were added to fill the gap. Resume source research, import the reviewed batches, then regenerate exports and rerun catalog checks when that expansion is resumed.","",
].join("\n"),"utf8");
console.table(expansionProgress);
console.table(progress);
console.log(
  `Exported ${accepted.length} accepted locations from ${directoryCandidates.length} candidates.`,
);

import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import baseline from "../lib/catalog/expansion-baseline.json";
import approved from "../lib/catalog/directory-expansion.json";
import {originalDirectoryCandidates,directoryListings,filterDirectory,directoryTargets} from "../lib/catalog/directory";
import {importDirectoryBatch,stableDirectoryJson,duplicateReason} from "../lib/catalog/directory-import";
import type {DirectoryCandidate} from "../lib/catalog/directory-schema";
import {directoryCandidateSchema} from "../lib/catalog/directory-schema";
import {discoveryPlace,discoveryStop} from "../lib/discovery";
import {directoryDetails} from "../lib/catalog/directory-details";
import {destination,selectableDestinations} from "../lib/destinations";
import {generateDemo,fromStop,minutes} from "../lib/engine";
import {defaultRequest,tripSchema} from "../lib/trip";
import {previewDiscoveryAddition,acceptDiscoveryAddition} from "../lib/discovery-planning";

const additions=approved as DirectoryCandidate[];
const options={protectedIds:new Set(baseline.records.map(p=>p.id)),knownCatalogIds:new Set(selectableDestinations.flatMap(d=>d.stops.map(s=>s.id)))};
test("original 200 records are unchanged; the saved 132 additions retain an explicit 18-place research shortfall",()=>{
  for(const p of baseline.records){const actual=directoryListings.find(r=>r.id===p.id);assert.ok(actual,p.id);assert.equal(createHash("sha256").update(stableDirectoryJson(actual)).digest("hex"),p.record_sha256,p.id);}
  assert.equal(additions.length,132);assert.equal(directoryListings.length,332);
  assert.equal(new Set(additions.map(p=>p.id)).size,132);
  assert.equal(Object.values(directoryTargets).reduce((a,b)=>a+b,0)-directoryListings.length,18);
  for(const group of Object.keys(baseline.starting_by_destination)){
    const rows=additions.filter(p=>p.destination_group===group);
    assert.equal(directoryListings.filter(p=>p.destination_group===group).length,baseline.starting_by_destination[group as keyof typeof baseline.starting_by_destination]+rows.length);
    assert.ok(directoryListings.filter(p=>p.destination_group===group).length<=directoryTargets[group]);
  }
  for(const p of additions){assert.equal(p.status,"accepted");assert.ok(!options.protectedIds.has(p.id));assert.ok(directoryCandidateSchema.safeParse(p).success,p.id);assert.equal(p.sources.identity.status,"verified");assert.equal(p.sources.municipality.status,"verified");if(p.latitude!==null)assert.equal(p.sources.coordinates.status,"verified");}
});
test("reimport is idempotent and duplicate IDs, alias variants, same-site spellings and unverified branches are rejected atomically",()=>{
  const first=importDirectoryBatch(originalDirectoryCandidates,additions,options);
  assert.equal(first.inserted+first.promoted,additions.length);
  const second=importDirectoryBatch(first.records,additions,options);
  assert.equal(second.inserted,0);assert.equal(second.promoted,0);assert.equal(second.updated,0);assert.equal(second.unchanged,additions.length);
  assert.deepEqual(second.records,first.records);
  const p=structuredClone(additions.find(p=>p.category==="Food & drink")!);
  assert.throws(()=>importDirectoryBatch([], [p,p]),/Duplicate ID/);
  const alias={...p,id:"test-duplicate-alias",slug:"test-duplicate-alias",catalog_stop_id:null,name:"An alternate public name",aliases:[p.name]};
  assert.throws(()=>importDirectoryBatch([p],[alias]),/duplicates/);
  const near={...p,id:"test-nearby-spelling",slug:"test-nearby-spelling",catalog_stop_id:null,aliases:[],name:p.name+" Cafe",address:"Same verified venue address",latitude:16.4,longitude:120.6};
  const coordinates={sourceName:"Fixture map",sourceUrl:"https://example.com/map",dateChecked:"2026-10-21",status:"verified" as const};
  const original={...p,address:"Same verified venue address",latitude:16.40001,longitude:120.60001,sources:{...p.sources,coordinates,address:coordinates}};
  near.sources={...p.sources,coordinates,address:coordinates};assert.ok(duplicateReason(near,original));
  const branch={...p,id:"test-other-branch",slug:"test-other-branch",catalog_stop_id:null,city_municipality:"Another verified municipality",address:null,sources:{...p.sources,address:{status:"unverified" as const,sourceName:null,sourceUrl:null,dateChecked:null}}};
  assert.throws(()=>importDirectoryBatch([p],[branch]),/branches need distinct verified addresses/);
  const distinct={...branch,address:"10 Second Street",sources:{...branch.sources,address:coordinates}};
  const addressed={...p,address:"20 First Street",sources:{...p.sources,address:coordinates}};
  assert.equal(duplicateReason(addressed,distinct),null);
  assert.deepEqual(p,additions.find(r=>r.id===p.id));
});
test("invalid evidence or coordinates cannot enter the published batch; optional fields do not inherit verification",()=>{
  const p=structuredClone(additions[0]);
  const invalid={...p,sources:{...p.sources,municipality:{status:"unverified",sourceName:null,sourceUrl:null,dateChecked:null}}};
  assert.throws(()=>importDirectoryBatch([], [invalid]));
  assert.throws(()=>importDirectoryBatch([], [{...p,latitude:100,longitude:120}]));
  const unknownPin={...p,latitude:16,longitude:120,sources:{...p.sources,coordinates:{status:"estimate",sourceName:"Fixture",sourceUrl:"https://example.com",dateChecked:null}}};
  assert.throws(()=>importDirectoryBatch([], [unknownPin]),/new coordinate pins/);
  for(const row of additions){const notes=directoryDetails(row)!;assert.ok(notes);assert.equal(notes.sources.schedule.status,"estimate");assert.equal(notes.sources.price.status,"estimate");if(notes.entryPrice.amount===null)assert.notEqual(notes.entryPrice.source.status,"verified");if(!row.planning?.accessibility_source)assert.equal(notes.sources.accessibility.status,"unverified");}
});
test("every addition appears in filters and details; only mapped places enter the existing itinerary selector",()=>{
  for(const p of additions){
    assert.ok(filterDirectory({group:p.destination_group,category:p.category,search:p.name}).some(r=>r.id===p.id),p.id);
    const place=discoveryPlace(p.id)!;assert.ok(place,p.id);assert.equal(place.directory?.city_municipality,p.city_municipality);
    assert.ok(directoryDetails(place.directory!));
    if(p.planning?.base_slug){const stop=destination(p.planning.base_slug)!.stops.find(s=>s.id===p.catalog_stop_id);assert.ok(stop,p.id);assert.ok(discoveryStop(place));assert.deepEqual(stop.geography?.sources.municipality,p.sources.municipality);}
    else assert.equal(place.baseSlug,null);
    for(const alias of p.aliases||[])assert.ok(filterDirectory({search:alias}).some(r=>r.id===p.id));
  }
});
test("new local options generate without re-verifying planning text, and confirmed additions retain metadata through serialization",()=>{
  let generated=0;
  for(const p of additions.filter(p=>p.planning?.base_slug&&p.planning.mode==="local"&&p.planning.scheduling==="candidate"&&!p.planning.requiresBooking)){
    const r={...defaultRequest,destinations:[p.planning!.base_slug!],startDate:"2026-12-10",days:4,budget:200000,tier:"Premium" as const,must:p.name};
    const trip=generateDemo(r),activity=trip.days.flatMap(d=>d.activities).find(a=>a.catalogStopId===p.catalog_stop_id);
    if(activity){generated++;assert.deepEqual(activity.geography?.sources.municipality,p.sources.municipality);assert.equal(activity.sources.schedule.status,"estimate");assert.equal(activity.sources.price.status,"estimate");assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(trip))),trip);}
  }
  assert.ok(generated>=30,`Expected varied new generated options, got ${generated}`);
  const p=additions.find(p=>p.planning?.mode==="local"&&p.planning.scheduling==="candidate"&&!p.planning.openingHours)!;
  const trip=generateDemo({...defaultRequest,startDate:"2026-12-10",destinations:[p.itinerary_base_slug!],days:3});for(const day of trip.days)day.activities=[];
  const before=JSON.stringify(trip),preview=previewDiscoveryAddition(trip,1,p.id,"10:00");assert.equal(JSON.stringify(trip),before);
  const accepted=acceptDiscoveryAddition(trip,preview);assert.deepEqual(accepted.days[1].activities[0].geography?.sources,p.sources);
  assert.throws(()=>previewDiscoveryAddition(accepted,2,p.id,"10:00"),/already in this trip/);
  const old=JSON.parse(JSON.stringify(accepted));for(const day of old.days)for(const a of day.activities)delete a.geography;
  assert.equal(tripSchema.parse(old).days[1].activities[0].geography,null);
});

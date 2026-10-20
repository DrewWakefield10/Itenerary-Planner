import {test} from "node:test";
import assert from "node:assert/strict";
import {destinations,selectableDestinations,destination} from "../lib/destinations";
import {validateCatalog} from "../lib/catalog/validate";
import {stopConflictKeys} from "../lib/catalog/identity";
import {visitStart} from "../lib/catalog/planning";
import {generateDemo,regenerateDay,fromStop,minutes,validateDay} from "../lib/engine";
import {defaultRequest,requestSchema,tripSchema} from "../lib/trip";
import {discoveryPlace,discoveryStop,discoveryPlaces} from "../lib/discovery";
import {previewDiscoveryAddition,acceptDiscoveryAddition} from "../lib/discovery-planning";
import {articleMappings} from "../lib/discovery-interest";

const request={...defaultRequest,startDate:"2026-12-10"};
test("catalog structure checks parent, IDs, aliases, coordinates, sources, prices and packages without asserting factual verification",()=>{
  assert.deepEqual(validateCatalog(destinations),[]);
  const groups=structuredClone(selectableDestinations);
  const s=groups[0].stops[0];s.baseSlug="bad-parent";s.lat=200;s.aliases.push(groups[0].stops[1].name);
  s.entryPrice={amount:null,basis:"unknown",source:{status:"verified",sourceName:"Incomplete",sourceUrl:null,dateChecked:null}};
  groups[0].stops.push({...s});
  const errors=validateCatalog(groups).join("\n");
  for(const message of ["incorrect parent","duplicate ID","duplicate name","lat","price","source"])assert.match(errors,new RegExp(message,"i"));
  const broken=structuredClone(selectableDestinations);broken[0].stops.find(s=>s.mode==="package")!.includes.push("missing-stop");
  assert.ok(validateCatalog(broken).some(e=>e.includes("missing component")));
});
test("every selectable base has researched additions; all catalog choices have exact mappings and no automatic trends",()=>{
  assert.equal(selectableDestinations.length,13);
  for(const d of selectableDestinations){
    assert.ok(d.stops.filter(s=>s.distinct).length>=15,d.slug);
    assert.ok(d.stops.some(s=>s.sources.description.status==="verified"),d.slug);
    for(const stop of d.stops.filter(s=>s.distinct&&s.mode!=="separate-base")) {
      const place=discoveryPlace(stop.id);
      assert.ok(place,stop.id);assert.equal(discoveryStop(place)!.baseSlug,d.slug);
      if(!place.wikipedia)assert.ok(!articleMappings.some(m=>m.placeId===place.id));
      if(stop.entryPrice.amount===null)assert.notEqual(stop.entryPrice.source.status,"verified");
    }
  }
});
test("long itineraries use unique places across days, conservative clusters and recorded hours for every base and pace",()=>{
  for(const d of selectableDestinations)for(const pace of ["Chill","Balanced","Packed"] as const){
    const trip=generateDemo({...request,destinations:[d.slug],days:21,pace,budget:200000,tier:"Premium",includeExcursions:true});
    const used=new Set<string>();
    for(const day of trip.days){
      const visits=day.activities.filter(a=>a.catalogStopId);
      if(visits.some(a=>a.visitMode!=="local"))assert.equal(visits.length,1);
      assert.ok(visits.length<=(pace==="Chill"?1:pace==="Balanced"?2:3));
      assert.ok(!validateDay(day).some(w=>w.includes("overlaps")));
      for(const a of visits){
        const s=d.stops.find(s=>s.id===a.catalogStopId)!;
        assert.ok(s);assert.equal(s.scheduling,"candidate");assert.notEqual(s.mode,"separate-base");assert.equal(s.componentOf.length,0);
        for(const key of stopConflictKeys(s,d.stops)){assert.ok(!used.has(key),`${d.slug}: repeated ${key}`);used.add(key);}
        assert.equal(visitStart(s,day.date,minutes(a.start),minutes(a.start)+a.duration,a.duration),minutes(a.start));
        assert.deepEqual(a.entryPrice,s.entryPrice);assert.deepEqual(a.sources.location,s.sources.location);assert.equal(a.sources.schedule.status,"estimate");
        if(a.visitMode!=="local"){assert.ok(a.duration>=480);assert.notEqual(day,trip.days[0]);assert.notEqual(day,trip.days.at(-1));}
      }
      assert.ok(new Set(visits.map(a=>a.cluster)).size<=1);
    }
    assert.ok(trip.warnings.some(w=>w.includes("too few suitable")),d.slug);
  }
});
test("excursions require opt-in, constrained bookings are not inferred, and regeneration respects other days and locks",()=>{
  const t=generateDemo({...request,destinations:["puerto-princesa"],days:10,budget:200000,tier:"Premium",includeExcursions:true});
  assert.ok(t.days.flatMap(d=>d.activities).some(a=>a.visitMode==="excursion"));
  assert.ok(!t.days.flatMap(d=>d.activities).some(a=>a.bookingRequired));
  const local=generateDemo({...t.request,includeExcursions:false});
  assert.ok(local.days.every(d=>d.activities.every(a=>a.visitMode==="local")));
  const locked=t.days[1].activities[0];locked.locked=true;
  const changed=regenerateDay(t,1);
  assert.deepEqual(changed.days[1].activities.find(a=>a.id===locked.id),locked);
  assert.deepEqual(changed.days.filter((_,i)=>i!==1),t.days.filter((_,i)=>i!==1));
  const ids=changed.days.flatMap(d=>d.activities.flatMap(a=>a.catalogStopId?[a.catalogStopId]:[]));assert.equal(ids.length,new Set(ids).size);
});
test("known hours, avoid and must requests influence suggestions without implying bookings",()=>{
  const s=destination("manila")!.stops.find(s=>s.openingHours)!;
  assert.equal(visitStart(s,"2026-12-10",19*60,23*60),null);
  const t=generateDemo({...request,destinations:["manila"],must:s.name,avoid:"Fort Santiago",days:4});
  assert.ok(t.days.flatMap(d=>d.activities).some(a=>a.catalogStopId===s.id));
  assert.ok(t.days.every(d=>d.activities.every(a=>a.name!=="Fort Santiago")));
});
test("discovery rejects cross-day and package/component duplication; previews are immutable and preserve unknown entry prices",()=>{
  const t=generateDemo({...request,destinations:["el-nido"],days:5});
  for(const d of t.days)d.activities=[];
  const p=destination("el-nido")!.stops.find(s=>s.mode==="package")!;
  const before=JSON.stringify(t),preview=previewDiscoveryAddition(t,1,p.id,"09:00");
  assert.equal(JSON.stringify(t),before);assert.equal(preview.activity.duration,480);
  const next=acceptDiscoveryAddition(t,preview);
  assert.deepEqual(next.days[1].activities[0].entryPrice,p.entryPrice);
  assert.throws(()=>previewDiscoveryAddition(next,2,p.id,"09:00"),/already in this trip/);
  assert.throws(()=>previewDiscoveryAddition(t,2,p.includes[0],"09:00"),/component/);
  const shared=destination("coron")!.stops.filter(s=>s.mode==="package");
  const pair=shared.flatMap(a=>shared.filter(b=>b!==a&&a.includes.some(id=>b.includes.includes(id))).map(b=>[a,b])).at(0)!;
  assert.ok(pair);
  const coron=generateDemo({...request,destinations:["coron"],days:5});for(const d of coron.days)d.activities=[];
  const accepted=acceptDiscoveryAddition(coron,previewDiscoveryAddition(coron,1,pair[0].id,"09:00"));
  assert.throws(()=>previewDiscoveryAddition(accepted,2,pair[1].id,"09:00"),/overlapping package/);
  assert.equal(discoveryPlace(p.id)?.wikipedia,undefined);
});
test("new metadata round-trips and older request/activity snapshots remain independent of the current catalog",()=>{
  const t=generateDemo({...request,destinations:["davao"],days:3});
  assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(t))),t);
  const old=JSON.parse(JSON.stringify(t));delete old.request.includeExcursions;
  const keys=["catalogStopId","canonicalStopId","entryPrice","visitMode","transferMinutes","bookingRequired","includedStopIds"];
  for(const d of old.days)for(const a of d.activities)for(const k of keys)delete a[k];
  const parsed=tripSchema.parse(old);assert.equal(parsed.request.includeExcursions,false);
  assert.ok(parsed.days.every(d=>d.activities.every(a=>a.catalogStopId===null&&a.entryPrice===null)));
  const current=destination("davao")!.stops.find(s=>s.name==="Museo Dabawenyo area")!;
  assert.equal(current.lat,null);assert.match(current.locationDetails,/Mabini/);
  const group={...current,cost:500,costBasis:"group" as const};assert.equal(fromStop(group,{...request,adults:4},"09:00").cost,500);
  const legacy=JSON.parse(JSON.stringify(request));delete legacy.includeExcursions;assert.equal(requestSchema.parse(legacy).includeExcursions,false);
});

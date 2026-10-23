import {test} from "node:test";
import assert from "node:assert/strict";
import {destination,selectableDestinations} from "../lib/destinations";
import {candidateStops,generateDemo,regenerateDay,minutes,validateDay} from "../lib/engine";
import {defaultRequest,requestSchema,tripSchema} from "../lib/trip";
import {placeTypes,matchesPlacePreferences} from "../lib/catalog/place-types";
import {activityKeys,closeEnough,visitStart} from "../lib/catalog/planning";
import {aiCandidateMenu,applyAiSelections} from "../lib/ai-selection";
import {createProvider} from "../lib/provider";
import {updateActivityField} from "../lib/activity-sources";

const request={...defaultRequest,startDate:"2026-12-10",randomSeed:"selection-regression",budget:200000,tier:"Premium" as const,days:5};
const ids=(t:ReturnType<typeof generateDemo>)=>t.days.map(d=>d.activities.flatMap(a=>a.catalogStopId?[a.catalogStopId]:[]));
test("explicit types distinguish real beaches, cafes, restaurants, islands, markets and malls",()=>{
  const stop=(base:string,id:string)=>destination(base)!.stops.find(s=>s.id===id)!;
  for(const id of ["boracay-jammers-beach-shack","boracay-dinibeach-bar","boracay-beach-truck","boracay-sands-bar-restaurant"]){
    assert.equal(matchesPlacePreferences(stop("boracay",id),{interests:[],activityCategories:["beach"]}),false,id);
    assert.equal(matchesPlacePreferences(stop("boracay",id),{interests:[],activityCategories:["cafe"]}),false,id);
  }
  assert.deepEqual(stop("boracay","boracay-cafe-del-sol").placeTypes,["cafe"]);
  assert.ok(stop("boracay","boracay-puka-shell-beach").placeTypes!.includes("beach"));
  assert.equal(stop("boracay","boracay-citymall").category,"Shopping");
  assert.equal(stop("cebu","cebu-carbon-market").category,"Markets");
  assert.equal(stop("siargao","siargao-naked-island").placeTypes!.includes("beach"),false);
  assert.equal(stop("siargao","siargao-cloud-9").placeTypes!.includes("beach"),false);
  assert.equal(matchesPlacePreferences({...stop("boracay","boracay-cafe-del-sol"),placeTypes:[]},{interests:[],activityCategories:["cafe"]}),false);
});
test("every exact type stays within the selected base across all bases, scheduling only matching unique catalog places",()=>{
  for(const base of selectableDestinations)for(const type of placeTypes){
    const t=generateDemo({...request,destinations:[base.slug],activityCategories:[type],days:7,includeExcursions:true});
    const used=new Set<string>();
    for(const day of t.days){
      assert.ok(!validateDay(day).some(w=>/overlaps|midnight/.test(w)));
      const visits=day.activities.filter(a=>a.catalogStopId);
      if(visits.some(a=>a.visitMode!=="local"))assert.equal(visits.length,1);
      for(const a of visits){
        const s=base.stops.find(s=>s.id===a.catalogStopId)!;
        assert.ok(s,`${base.slug}: ${a.name}`);assert.equal(s.baseSlug,day.destination);assert.ok(a.placeTypes.includes(type));
        assert.equal(visitStart(s,day.date,minutes(a.start),minutes(a.start)+a.duration,a.duration),minutes(a.start));
        for(const key of activityKeys(a,base.stops)){assert.ok(!used.has(key),key);used.add(key);}
        assert.deepEqual(a.sources.location,s.sources.location);assert.equal(a.sources.schedule.status,"estimate");
      }
      for(let i=1;i<visits.length;i++){
        assert.ok(closeEnough(base.stops.find(s=>s.id===visits[i-1].catalogStopId)!,base.stops.find(s=>s.id===visits[i].catalogStopId)!));
        assert.ok(minutes(visits[i].start)-minutes(visits[i-1].start)-visits[i-1].duration>=45);
      }
    }
  }
});
test("seeded randomization varies tied choices without changing exact-category or must/avoid constraints",()=>{
  const r={...request,destinations:["boracay"],activityCategories:["restaurant" as const],interests:["Food Hunter"]};
  assert.deepEqual(ids(generateDemo(r)),ids(generateDemo(r)));
  const variants=new Set(Array.from({length:12},(_,i)=>JSON.stringify(ids(generateDemo({...r,randomSeed:`variety-${i}`})))));
  assert.ok(variants.size>1,"Equivalent eligible choices should vary");
  const t=generateDemo({...r,must:"Cafe del Sol",avoid:"Jammers Beach Shack"});
  assert.ok(!t.days.flatMap(d=>d.activities).some(a=>a.name==="Cafe del Sol"||a.name==="Jammers Beach Shack"));
  assert.ok(t.warnings.some(w=>w.includes("Cafe del Sol")&&w.includes("not scheduled")));
  const beach=generateDemo({...request,destinations:["boracay"],interests:["Beach Bum"]});
  assert.ok(beach.days.flatMap(d=>d.activities).filter(a=>a.catalogStopId).every(a=>a.placeTypes.includes("beach")));
  const bases=generateDemo({...request,destinations:["el-nido","coron","puerto-princesa"],activityCategories:["beach"],days:11});
  assert.equal(bases.days.filter(d=>d.transfer).length,2);
  for(const day of bases.days)for(const a of day.activities.filter(a=>a.catalogStopId)){
    assert.ok(destination(day.destination)!.stops.some(s=>s.id===a.catalogStopId&&s.baseSlug===day.destination));
    assert.ok(a.placeTypes.includes("beach"));
  }
});
test("shortages never substitute unrelated venues and regeneration keeps categories, locks and other days",()=>{
  const none=generateDemo({...request,destinations:["baguio"],activityCategories:["beach"]});
  assert.ok(none.days.every(d=>d.activities.every(a=>!a.catalogStopId)));
  assert.ok(none.warnings.some(w=>w.includes("0 beaches")));assert.ok(none.warnings.some(w=>w.includes("too few suitable")));
  const t=generateDemo({...request,destinations:["siargao"],activityCategories:["cafe"]});
  assert.ok(t.days.flatMap(d=>d.activities).filter(a=>a.catalogStopId).length>=1);
  t.days[0].activities.find(a=>a.catalogStopId)!.locked=true;
  const before=JSON.stringify(t),changed=regenerateDay(t,0,3);
  assert.equal(JSON.stringify(t),before);assert.deepEqual(changed.days.slice(1),t.days.slice(1));
  assert.deepEqual(changed.days[0].activities.find(a=>a.locked),t.days[0].activities.find(a=>a.locked));
  assert.ok(changed.days.flatMap(d=>d.activities).filter(a=>a.catalogStopId).every(a=>a.placeTypes.includes("cafe")));
});
test("candidate policy excludes wrong bases, missing booking, manual access, closed hours and disallowed excursions",()=>{
  const r={...request,destinations:["el-nido"],interests:[],activityCategories:[]};
  for(const s of candidateStops(r,"el-nido",0)){assert.equal(s.baseSlug,"el-nido");assert.equal(s.mode,"local");assert.equal(s.requiresBooking,false);}
  assert.ok(!candidateStops({...r,destinations:["boracay"]},"boracay",1).some(s=>s.id==="boracay-mount-luho"));
  const museum=destination("manila")!.stops.find(s=>s.openingHours)!;
  const original=structuredClone(museum.openingHours);
  try{
    museum.openingHours={...museum.openingHours!,weekdays:[0],opens:"08:00",closes:"10:00"};
    assert.ok(!candidateStops({...r,destinations:["manila"],must:museum.name},"manila",0).some(s=>s.id===museum.id));
  }finally{museum.openingHours=original;}
  const a=destination("baguio")!.stops.find(s=>s.id==="baguio-burnham-park")!;
  const b={...a,id:"fixture",lat:5,lng:125};
  assert.equal(closeEnough({...a,sources:{...a.sources,coordinates:{sourceName:"Fixture",sourceUrl:"https://example.com",dateChecked:"2026-10-22",status:"verified"}}},{...b,sources:{...b.sources,coordinates:{sourceName:"Fixture",sourceUrl:"https://example.com",dateChecked:"2026-10-22",status:"verified"}}}),false);
  assert.equal(closeEnough(a,{...a,cluster:"different-area"}),false);
});
test("AI proposals are transactional and reject unknown, wrong-type/base, duplicate and incompatible-cluster IDs",()=>{
  const t=generateDemo({...request,destinations:["siargao"],activityCategories:["cafe"]}),before=JSON.stringify(t);
  const cafe="siargao-brunch-spot";
  for(const stopIds of [["invented-cafe"],["bohol-common-crew"],["boracay-jammers-beach-shack"],[cafe,cafe]])assert.throws(()=>applyAiSelections(t,[{dayIndex:0,stopIds}]));
  assert.throws(()=>applyAiSelections(t,[{dayIndex:0,stopIds:[cafe]},{dayIndex:1,stopIds:[cafe]}]),/conflict|repeat/);
  assert.throws(()=>applyAiSelections(t,[{dayIndex:0,stopIds:[]},{dayIndex:0,stopIds:[]}]),/Duplicate/);
  const el=generateDemo({...request,destinations:["el-nido"],activityCategories:["beach"]});
  assert.throws(()=>applyAiSelections(el,[{dayIndex:0,stopIds:[]},{dayIndex:1,stopIds:["el-nido-corong-corong-beach","el-nido-duli-beach"]}]),/geography|menu/);
  const aliases=generateDemo({...request,destinations:["boracay"],activityCategories:["beach"]});
  assert.throws(()=>applyAiSelections(aliases,aliases.days.map((_d,dayIndex)=>({dayIndex,stopIds:dayIndex===1?["boracay-white-beach-station-1"]:dayIndex===2?["boracay-white-beach-station-2"]:[]}))),/conflict|repeat/);
  const connection=generateDemo({...request,destinations:["el-nido","coron"],days:7});
  assert.throws(()=>applyAiSelections(connection,[{dayIndex:connection.days.findIndex(d=>d.transfer),stopIds:[]}]),/connection/);
  assert.equal(JSON.stringify(t),before);
});
test("accepted AI catalog choices preserve independent evidence, estimates and exact ID ownership",()=>{
  const t=generateDemo({...request,destinations:["siargao"],activityCategories:["cafe"]});
  const next=applyAiSelections(t,t.days.map((d,dayIndex)=>({dayIndex,stopIds:dayIndex===1?["siargao-brunch-spot"]:[]})));
  assert.equal(t.days[0].activities.some(a=>a.catalogStopId),true);
  const a=next.days[1].activities.find(a=>a.catalogStopId)!;
  const source=destination("siargao")!.stops.find(s=>s.id===a.catalogStopId)!;
  assert.deepEqual(a.sources.location,source.sources.location);assert.deepEqual(a.sources.description,source.sources.description);
  assert.deepEqual(a.entryPrice,source.entryPrice);assert.equal(a.sources.schedule.status,"estimate");assert.ok(a.placeTypes.includes("cafe"));
  assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(next))),next);
});
test("provider sends bounded exact-ID menus, applies valid choices, and falls back without applying invalid proposals",async()=>{
  const previous=globalThis.fetch;
  try{
    for(const invalid of [false,true]){
      globalThis.fetch=async(_url,options)=>{
        const payload=JSON.parse(options!.body as string),user=JSON.parse(payload.messages[1].content);
        assert.ok(user.menus.every((d:{candidates:unknown[]})=>d.candidates.length<=24));
        assert.ok(user.menus[1].candidates.some((c:{id:string})=>c.id==="siargao-brunch-spot"));
        return Response.json({choices:[{message:{content:JSON.stringify({title:"A coffee journal",dayTitles:Array(5).fill("Coffee and open time"),notes:"Confirm venue details",selections:user.menus.map((d:{dayIndex:number})=>({dayIndex:d.dayIndex,stopIds:d.dayIndex===1?[invalid?"unknown-cafe":"siargao-brunch-spot"]:[]}))})}}]});
      };
      const t=await createProvider({key:"fixture",url:"https://example.com/chat",model:"fixture"}).generateItinerary({...request,destinations:["siargao"],activityCategories:["cafe"]});
      assert.equal(t.mode,invalid?"demo":"ai");
      assert.ok(t.days.flatMap(d=>d.activities).filter(a=>a.catalogStopId).every(a=>a.placeTypes.includes("cafe")));
      if(invalid)assert.ok(t.warnings.some(w=>w.includes("kept unchanged")));
      else assert.equal(t.days[1].activities.some(a=>a.catalogStopId==="siargao-brunch-spot"),true);
    }
  }finally{globalThis.fetch=previous;}
});
test("older saved requests remain compatible and user renaming clears the old type instead of inheriting it",()=>{
  const t=generateDemo({...request,destinations:["siargao"],activityCategories:["cafe"]});
  const a=t.days.flatMap(d=>d.activities).find(a=>a.catalogStopId)!;
  assert.deepEqual(updateActivityField(a,"name","My personal visit").placeTypes,[]);
  const old=JSON.parse(JSON.stringify(t));delete old.request.activityCategories;delete old.request.randomSeed;
  for(const d of old.days)for(const a of d.activities)delete a.placeTypes;
  const parsed=tripSchema.parse(old);assert.deepEqual(parsed.request.activityCategories,[]);assert.equal(parsed.request.randomSeed,null);
  assert.ok(parsed.days.every(d=>d.activities.every(a=>a.placeTypes.length===0)));
  assert.equal(requestSchema.safeParse({...request,activityCategories:["not-a-type"]}).success,false);
  assert.ok(aiCandidateMenu(t).flatMap(d=>d.candidates).every(s=>s.placeTypes.includes("cafe")));
});

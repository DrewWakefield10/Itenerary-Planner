import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {directoryListings,filterDirectory,categoryForPlace,destinationGroups,directoryCandidates} from '../lib/catalog/directory';
import {importDirectoryBatch} from '../lib/catalog/directory-import';
import {foodProfiles,foodForPlace,isFoodStop,isMealStop,isCoffeeStop} from '../lib/catalog/food';
import {foodProfileSchema} from '../lib/catalog/food-schema';
import {destination,selectableDestinations} from '../lib/destinations';
import {generateDemo,fromStop,validateDay,visitLimit} from '../lib/engine';
import {defaultRequest,tripSchema} from '../lib/trip';
import {aiCandidateMenu,applyAiSelections} from '../lib/ai-selection';
import {discoveryPlace,placeCoordinates} from '../lib/discovery';
import additions from '../lib/catalog/directory-food.json';
import baseline from '../docs/food-directory/baseline.json';
import {placeContents} from '../lib/catalog/place-content';
import {visitStart} from '../lib/catalog/planning';
import type {DirectoryCandidate} from '../lib/catalog/directory-schema';
import {beforeCoverAdditions} from './helpers/cover-preservation';
const request={...defaultRequest,startDate:'2026-12-10',randomSeed:'food-regression',budget:200000,tier:'Premium' as const,days:5,interests:[],activityCategories:[]};
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('reviewed food additions count once, cover all destinations and preserve every previous identity and text',()=>{
 assert.equal(baseline.foodIds.length,58);assert.equal(additions.length,94);assert.equal(foodProfiles.length,152);
 assert.equal(new Set(foodProfiles.map(p=>p.placeId)).size,152);
 assert.equal(foodProfiles.filter(p=>p.primary==='cafe').length,56);
 for(const id of baseline.placeIds)assert.ok(directoryListings.some(p=>p.id===id),id);
 for(const group of destinationGroups)assert.ok(foodProfiles.some(f=>directoryListings.find(p=>p.id===f.placeId)?.destination_group===group));
 for(const p of foodProfiles)foodProfileSchema.parse(p);
 // The prior photo pass's original text overlay remains immutable.
 const original=beforeCoverAdditions(read('lib/catalog/place-content.json')).filter((p:{placeId:string})=>baseline.contentIds.includes(p.placeId));
 assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),baseline.contentHash);
 assert.equal(foodForPlace('bohol-green-thumb-farm'),undefined);
 assert.equal(categoryForPlace(directoryListings.find(p=>p.id==='bohol-green-thumb-farm')!),'Nature');
});
test('café, coffee, meal, bakery and food-market search require supported venue roles and combine with municipality/category',()=>{
 for(const p of filterDirectory({search:'café'}))assert.ok(foodForPlace(p.id)?.primary==='cafe'||foodForPlace(p.id)?.suitability.includes('coffee'),p.id);
 for(const p of filterDirectory({search:'coffee'}))assert.ok(foodForPlace(p.id)?.suitability.includes('coffee'),p.id);
 assert.ok(filterDirectory({search:'food'}).some(p=>p.id==='davao-apo-ni-lola-matina'));
 assert.ok(!filterDirectory({search:'food'}).some(p=>p.id==='bohol-green-thumb-farm'));
 for(const p of filterDirectory({search:'restaurants'}))assert.ok(foodForPlace(p.id)?.suitability.includes('meal'));
 assert.ok(filterDirectory({group:'Iloilo',category:'Food & drink',foodType:'cafe',search:'Mandurriao'}).length>=3);
 assert.ok(filterDirectory({group:'Manila',foodType:'cafe',search:'Makati'}).every(p=>p.city_municipality==='Makati'));
 for(const p of filterDirectory({foodType:'market'}))assert.equal(foodForPlace(p.id)?.venueType,'food-market');
 for(const id of ['boracay-jammers-beach-shack','boracay-dinibeach-bar','bohol-green-thumb-farm'])assert.ok(!filterDirectory({search:'cafes'}).some(p=>p.id===id));
 assert.ok(filterDirectory({search:'nitro cold brew'}).some(p=>p.id==='iloilo-monkey-grounds'));
 assert.ok(filterDirectory({search:'cafes'}).some(p=>p.id==='puerto-princesa-jeju-island-cafe'));
 assert.ok(!filterDirectory({search:'coffee'}).some(p=>p.id==='puerto-princesa-jeju-island-cafe'));
 assert.deepEqual(foodForPlace('puerto-princesa-jeju-island-cafe')!.suitability,[]);
});
test('new venues carry independent unknown facts and preserved source status through catalog generation and import',()=>{
 for(const row of additions){
  const f=foodForPlace(row.id)!;assert.notEqual(f.operation.basis,'existing-source');assert.equal(f.operation.source.status,'verified');
  assert.equal(row.latitude,null);assert.equal(row.longitude,null);assert.equal(row.sources.coordinates.status,'unverified');assert.equal(placeCoordinates(discoveryPlace(row.id)!),null);
  const s=row.planning.base_slug?destination(row.planning.base_slug)!.stops.find(s=>s.id===row.id):undefined;
  if(!s)continue;
  const activity=fromStop(s,request,'10:00');assert.deepEqual(activity.sources.location,s.sources.location);assert.equal(activity.sources.price.status,'estimate');assert.equal(activity.sources.schedule.status,'estimate');
  assert.ok(activity.entryPrice);assert.equal(activity.entryPrice.amount,null);assert.equal(activity.kind,'Food');assert.equal(activity.category,'Food');
 }
 const t=generateDemo({...request,destinations:['cebu'],activityCategories:['cafe']});
 assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(t))),t);
 const old=JSON.parse(JSON.stringify(t));delete old.request.activityCategories;for(const d of old.days)for(const a of d.activities)delete a.placeTypes;
 assert.ok(tripSchema.safeParse(old).success);
});
test('reimport remains idempotent and rejects same-name branch duplication without verified independent addresses',()=>{
 const result=importDirectoryBatch(directoryCandidates,additions);
 assert.equal(result.inserted,0);assert.equal(result.promoted,0);assert.equal(result.unchanged,94);
 const row=additions[0] as DirectoryCandidate;
 assert.throws(()=>importDirectoryBatch(directoryCandidates,[{...row,id:'fake-new-food-id',catalog_stop_id:null,slug:'fake-new-food-id'}]),/duplicates/);
});
test('larger food catalogs preserve ordinary sightseeing, pacing, geographic constraints and AI draft compatibility',()=>{
 for(const base of selectableDestinations)for(const pace of ['Chill','Balanced','Packed'] as const){
  const t=generateDemo({...request,destinations:[base.slug],pace});
  const before=JSON.stringify(t),menu=aiCandidateMenu(t);
  assert.ok(menu.every(d=>d.candidates.length<=24));
  const selected=t.days.map((day,dayIndex)=>({dayIndex,stopIds:day.activities.flatMap(a=>a.catalogStopId?[a.catalogStopId]:[])}));
  assert.doesNotThrow(()=>applyAiSelections(t,selected,menu),`${base.slug} ${pace}`);
  assert.equal(JSON.stringify(t),before);
  for(const [i,d]of t.days.entries()){
   assert.ok(!validateDay(d).some(w=>/overlaps|midnight/.test(w)),`${base.slug}: ${validateDay(d)}`);
   const visits=d.activities.filter(a=>a.catalogStopId),foods=visits.filter(a=>isFoodStop(base.stops.find(s=>s.id===a.catalogStopId)!));
   assert.ok(visits.length<=visitLimit(t.request,i));assert.ok(foods.length<=1);
   if(visits.length>1)assert.ok(visits.some(a=>!isFoodStop(base.stops.find(s=>s.id===a.catalogStopId)!)));
   const namedMeals=visits.filter(a=>isMealStop(base.stops.find(s=>s.id===a.catalogStopId)!));
   if(namedMeals.length)assert.ok(!d.activities.some(a=>a.name==='Flexible meal break'));
   assert.equal(d.food,Math.max(0,550*(request.adults+request.children)-foods.reduce((sum,a)=>sum+a.cost,0)));
  }
 }
});
test('coffee and food-focused trips never use beaches as café stops, and constrained shortages retain open time',()=>{
 for(const slug of ['siargao','cebu','boracay','baguio','davao']){
  const t=generateDemo({...request,destinations:[slug],activityCategories:['cafe'],days:7});
  const ids=new Set<string>();
  for(const a of t.days.flatMap(d=>d.activities).filter(a=>a.catalogStopId)){
   const s=destination(slug)!.stops.find(s=>s.id===a.catalogStopId)!;assert.ok(s.placeTypes?.includes('cafe'));assert.ok(foodForPlace(s.id));assert.ok(!ids.has(s.canonicalId));ids.add(s.canonicalId);
  }
 }
 const empty=generateDemo({...request,destinations:['sagada'],activityCategories:['beach']});
 assert.ok(!empty.days.flatMap(d=>d.activities).some(a=>a.catalogStopId));assert.ok(empty.warnings.some(w=>w.includes('too few suitable')));
 const coffee=destination('davao')!.stops.find(s=>s.id==='davao-purge-tulip')!;
 assert.equal(isCoffeeStop(coffee),true);assert.equal(isMealStop(coffee),false);
 assert.equal(destination('bohol')!.stops.find(s=>s.id==='bohol-saffron-restaurant')!.scheduling,'manual');
 const weekend=destination('siargao')!.stops.find(s=>s.id==='siargao-weekend-cafe')!;
 assert.equal(visitStart(weekend,'2026-12-08',9*60,18*60),null,'Closed Tuesday is not inferred open');
 assert.equal(visitStart(weekend,'2026-12-09',9*60,18*60),9*60);
 const price=foodForPlace('iloilo-netongs-la-paz')!.publishedPrices!;
 assert.match(price.text,/15 April 2026/);assert.equal(price.source.status,'verified');
 assert.equal(destination('iloilo')!.stops.find(s=>s.id==='iloilo-netongs-la-paz')!.sources.price.status,'estimate');
});
test('AI rejects excessive restaurant selections, wrong bases and incompatible new-venue clusters transactionally',()=>{
 const t=generateDemo({...request,destinations:['boracay'],pace:'Packed'}),menu=aiCandidateMenu(t),before=JSON.stringify(t);
 const food=menu[1].candidates.filter(c=>c.food).slice(0,2);assert.equal(food.length,2);
 assert.throws(()=>applyAiSelections(t,[{dayIndex:1,stopIds:food.map(c=>c.id)}],menu),/food balance/);
 assert.throws(()=>applyAiSelections(t,[{dayIndex:1,stopIds:['davao-purge-tulip']}]),/menu/);
 const cafe=generateDemo({...request,destinations:['davao'],activityCategories:['cafe']});
 assert.throws(()=>applyAiSelections(cafe,cafe.days.map((_d,dayIndex)=>({dayIndex,stopIds:dayIndex===1?['davao-purge-tulip','davao-fourth-street-narra']:[]}))),/geography|schedule/);
 assert.equal(JSON.stringify(t),before);
});
test('photo decisions cover all additions; only explicitly licensed and visually approved exact venues are published',()=>{
 const decisions=read('docs/food-directory/media/decisions.json');assert.equal(decisions.entries.length,94);
 for(const d of decisions.entries){const photo=placeContents.find(p=>p.placeId===d.placeId)?.photo;
  if(d.approved){assert.ok(d.visuallyReviewed&&d.licenseReviewed&&photo);assert.equal(photo.sourcePage,d.photo.sourcePage);assert.ok(d.identityEvidence.length>=2);}
  else{assert.equal(photo,undefined);assert.ok(d.reason&&d.sourcesSearched.length);}
 }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateDemo,budgetSummary,validateDay,fromStop} from '../lib/engine';
import {destination} from '../lib/destinations';
import {defaultRequest,tripSchema} from '../lib/trip';
import {assessRainForecast,FORECAST_MAX_AGE_MS,type Forecast} from '../lib/weather';
import {rainAlternativeFor,affectedRainActivities,previewRainReplacement} from '../lib/rain-planning';
import {updateActivityField} from '../lib/activity-sources';

const base={...defaultRequest,startDate:'2026-12-10',days:3};
const now=Date.parse('2026-12-10T00:00:00Z');
const forecast:Forecast={available:true,date:'2026-12-10',rain:80,weatherCode:63,retrievedAt:new Date(now).toISOString()};
const baguio=()=>generateDemo({...base,destinations:['baguio']});
const parkId=(trip:ReturnType<typeof baguio>)=>trip.days[0].activities.find(a=>a.name==='Burnham Park')!.id;

test('fresh daily rain signals use explicit thresholds; missing, stale, future-dated, and mismatched data never imply favorable conditions',()=>{
  assert.equal(assessRainForecast(forecast,base.startDate,now).attention,true);
  assert.equal(assessRainForecast({...forecast,rain:30,weatherCode:81},base.startDate,now).attention,true);
  assert.equal(assessRainForecast({...forecast,rain:69,weatherCode:0},base.startDate,now).attention,false);
  for(const f of [null,{available:false},{...forecast,date:'2026-12-11'},{...forecast,rain:null,weatherCode:null},{...forecast,retrievedAt:undefined},{...forecast,retrievedAt:new Date(now-FORECAST_MAX_AGE_MS-1).toISOString()},{...forecast,retrievedAt:new Date(now+10*60*1000).toISOString()}]){
    const result=assessRainForecast(f,base.startDate,now);assert.equal(result.attention,false);assert.equal(result.usable,false);
  }
  assert.equal(assessRainForecast({...forecast,date:'2026-12-09'},'2026-12-09',now).usable,false);
});

test('suggestions match the destination and recorded rain tag; marine/heat tags do not trigger rain replacements',()=>{
  const trip=baguio(),id=parkId(trip);
  const alt=rainAlternativeFor(trip,0,id).alternative!;
  assert.equal(alt.replacement.name,'Session Road cafe break');
  assert.equal(alt.replacement.cluster,'central');
  for(const sensitivities of [[],['heat'],['marine-conditions']] as const){
    const copy=structuredClone(trip);copy.days[0].activities.find(a=>a.id===id)!.disruptionSensitivities=[...sensitivities];
    assert.equal(rainAlternativeFor(copy,0,id).alternative,undefined);
    assert.equal(affectedRainActivities(copy,0).some(x=>x.activity.id===id),false);
  }
  const unsupported=generateDemo({...base,destinations:['palawan']});
  assert.ok(affectedRainActivities(unsupported,0).every(x=>!x.alternative));
  const cebu=generateDemo({...base,destinations:['cebu']});
  const candidate=affectedRainActivities(cebu,0).find(x=>x.alternative)!.alternative!;
  assert.equal(candidate.replacement.name,'Casa Gorordo Museum area');
  assert.equal(candidate.replacement.openingHours?.source.sourceUrl,'https://www.casagorordomuseum.org/');
});

test('time buffers, known opening hours, locks, duplicates, and location uncertainty constrain proposals',()=>{
  const trip=baguio(),id=parkId(trip);
  const locked=structuredClone(trip);locked.days[0].activities.find(a=>a.id===id)!.locked=true;
  assert.match(rainAlternativeFor(locked,0,id).reason!,/locked/);
  const short=structuredClone(trip);short.days[0].activities.find(a=>a.id===id)!.duration=15;
  assert.match(rainAlternativeFor(short,0,id).reason!,/do not fit/);
  const remote=structuredClone(trip);remote.days[0].activities.find(a=>a.id===id)!.lat=10;
  assert.match(rainAlternativeFor(remote,0,id).reason!,/local planning area/);
  const duplicate=structuredClone(trip);duplicate.days[0].activities.push(fromStop(destination('baguio')!.stops.find(s=>s.name==='Session Road cafe break')!,base,'17:00'));
  assert.match(rainAlternativeFor(duplicate,0,id).reason!,/already in this day/);
  const sunday=generateDemo({...base,startDate:'2026-12-13',destinations:['cebu']});
  assert.ok(affectedRainActivities(sunday,0).every(x=>!x.alternative&&/opening/.test(x.unavailableReason||'')));
  const late=generateDemo({...base,destinations:['cebu']});const stop=late.days[0].activities.find(a=>a.disruptionSensitivities.includes('heavy-rain'))!;stop.start='17:00';
  assert.equal(rainAlternativeFor(late,0,stop.id).alternative,undefined);
});

test('previews are immutable; acceptance changes exactly one stop and recalculates group costs',()=>{
  const trip=baguio(),before=structuredClone(trip),id=parkId(trip);
  const suggestion=rainAlternativeFor(trip,0,id).alternative!;
  const proposal=previewRainReplacement(trip,0,suggestion);
  assert.deepEqual(trip,before);
  assert.deepEqual(proposal.days.slice(1),trip.days.slice(1));
  assert.deepEqual(proposal.days[0].activities.filter(a=>a.id!==id),trip.days[0].activities.filter(a=>a.id!==id));
  assert.equal(budgetSummary(proposal).total-budgetSummary(trip).total,suggestion.costDifference);
  assert.equal(proposal.days[0].activities.find(a=>a.id===id)?.name,'Session Road cafe break');
  assert.ok(!validateDay(proposal.days[0]).some(w=>/overlap|insufficient/.test(w)));
  const stale=structuredClone(trip);stale.days[0].activities.find(a=>a.id===id)!.locked=true;
  assert.throws(()=>previewRainReplacement(stale,0,suggestion),/no longer/);
});

test('replacement and serialized tags/hours retain independent metadata and estimate labels',()=>{
  const trip=generateDemo({...base,destinations:['cebu']});const alt=affectedRainActivities(trip,0).find(x=>x.alternative)!.alternative!;
  const proposed=previewRainReplacement(trip,0,alt);
  const imported=tripSchema.parse(JSON.parse(JSON.stringify(proposed)));
  const stop=imported.days[0].activities.find(a=>a.id===alt.original.id)!;
  assert.equal(stop.sources.price.status,'estimate');assert.equal(stop.sources.schedule.status,'estimate');
  assert.equal(stop.openingHours?.source.status,'verified');
  assert.deepEqual(stop.sources.location,destination('cebu')!.stops.find(s=>s.name===alt.replacement.name)!.sources.location);
  assert.deepEqual(stop.disruptionSensitivities,[]);
  const renamed=updateActivityField(stop,'name','A different venue');assert.equal(renamed.openingHours,null);assert.deepEqual(renamed.disruptionSensitivities,[]);
});

test('older saved trips without tags and hours validate and receive no inferred rain recommendations',()=>{
  const old=JSON.parse(JSON.stringify(baguio()));
  for(const day of old.days)for(const a of day.activities){delete a.disruptionSensitivities;delete a.openingHours;}
  const parsed=tripSchema.parse(old);
  assert.deepEqual(affectedRainActivities(parsed,0),[]);
  assert.ok(parsed.days.every(d=>d.activities.every(a=>a.openingHours===null&&a.disruptionSensitivities.length===0)));
});

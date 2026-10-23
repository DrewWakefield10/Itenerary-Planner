import {z} from "zod/v3";
import {candidateStops,makeDay,refreshSelectionWarnings,visitLimit,foodFocusedRequest} from "./engine";
import {isFoodStop,isMealStop,isCoffeeStop} from "./catalog/food";
import {mentioned} from "./catalog/planning";
import type {Trip} from "./trip";

export const aiSelectionsSchema=z.array(z.object({dayIndex:z.number().int().min(0).max(20),stopIds:z.array(z.string().min(1).max(100)).max(3)}).strict()).max(21);
export type AiSelections=z.infer<typeof aiSelectionsSchema>;

/** Bounded, exact-ID menus. No user/model-authored coordinates, categories,
 * prices, opening hours or verification statuses enter this contract. */
export function aiCandidateMenu(trip:Trip){
  return trip.days.map((day,dayIndex)=>{
    const eligible=day.transfer?[]:candidateStops(trip.request,day.destination,dayIndex);
    const current=day.activities.flatMap(a=>a.catalogStopId?[a.catalogStopId]:[]);
    const priority=[...eligible.filter(s=>current.includes(s.id)),...eligible.filter(s=>!current.includes(s.id))];
    const foodFocused=foodFocusedRequest(trip.request);
    // Preserve the draft, then reserve menu capacity for sightseeing even when
    // the directory contains substantially more restaurants than attractions.
    const chosen=new Map(priority.filter(s=>current.includes(s.id)).map(s=>[s.id,s]));
    const groups=foodFocused?[priority]:[priority.filter(s=>!isFoodStop(s)).slice(0,16),priority.filter(isFoodStop).slice(0,8)];
    for(const group of groups)for(const s of group)if(chosen.size<24)chosen.set(s.id,s);
    const ordered=[...chosen.values()];
    return {dayIndex,date:day.date,destination:day.destination,connection:day.transfer,
      maxVisits:visitLimit(trip.request,dayIndex),foodFocused,maxFoodStops:foodFocused?visitLimit(trip.request,dayIndex):Math.max(1,eligible.filter(s=>isFoodStop(s)&&mentioned(s,trip.request.must)).length),
      candidates:ordered.map(s=>({id:s.id,name:s.name,placeTypes:s.placeTypes||[],food:isFoodStop(s),meal:isMealStop(s),coffee:isCoffeeStop(s),cluster:s.cluster,minutes:s.minutes,mode:s.mode,hours:s.openingHours||null,allowance:s.cost,allowanceBasis:s.costBasis})),current};
  });
}

/** Transactional validation: one invalid selection discards the entire proposal.
 * Rebuild from trusted catalog facts and recheck every day against trip-wide
 * canonical/package usage, hours, pacing, transfers and exact base/type policy. */
export function applyAiSelections(trip:Trip,input:AiSelections,menu=aiCandidateMenu(trip)):Trip{
  const selections=aiSelectionsSchema.parse(input);
  if(new Set(selections.map(s=>s.dayIndex)).size!==selections.length)throw new Error("Duplicate AI day");
  for(const choice of selections){
    const day=menu[choice.dayIndex];
    if(!day||day.connection)throw new Error("AI cannot change a connection day");
    if(new Set(choice.stopIds).size!==choice.stopIds.length||choice.stopIds.some(id=>!day.candidates.some(s=>s.id===id)))throw new Error("AI selected an ID outside its eligible menu");
    const limit=visitLimit(trip.request,choice.dayIndex);
    if(choice.stopIds.length>limit)throw new Error("AI exceeded the day's pace");
    const selected=choice.stopIds.map(id=>day.candidates.find(s=>s.id===id)!);
    if(!day.foodFocused&&selected.filter(s=>s.food).length>day.maxFoodStops)throw new Error("AI exceeded the day's food balance");
  }
  const next=structuredClone(trip),used=new Set<string>();
  for(let i=0;i<trip.days.length;i++){
    const old=trip.days[i];
    if(old.transfer)continue;
    const ids=selections.find(s=>s.dayIndex===i)?.stopIds||old.activities.flatMap(a=>a.catalogStopId?[a.catalogStopId]:[]);
    const generated=makeDay(trip.request,old.destination,i,i,0,used,ids);
    const actual=generated.activities.flatMap(a=>a.catalogStopId?[a.catalogStopId]:[]);
    if(actual.length!==ids.length||ids.some((id,j)=>actual[j]!==id))throw new Error("AI selections conflict, repeat, or do not fit the day's geography and schedule");
    // makeDay is the scheduler, never a model-authored schedule.
    next.days[i]={...generated,id:old.id,title:old.title};
  }
  return refreshSelectionWarnings(next);
}

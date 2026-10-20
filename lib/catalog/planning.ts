import type {Stop} from "./types";
import {normalizePlaceName,stopConflictKeys,stopMatchesName} from "./identity";
import type {Activity} from "../trip";

const time=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));
export function activityKeys(a:Activity,catalog:Stop[]) {
  const stop=catalog.find(s=>s.id===a.catalogStopId)||catalog.find(s=>stopMatchesName(s,a.name));
  return new Set([...(stop?stopConflictKeys(stop,catalog):[]),...(a.canonicalStopId?[a.canonicalStopId]:[]),...a.includedStopIds.map(id=>catalog.find(s=>s.id===id)?.canonicalId||id)]);
}
export function conflictsWithUsed(stop:Stop,used:Set<string>,catalog:Stop[]) {
  return [...stopConflictKeys(stop,catalog)].some(k=>used.has(k));
}
export function markUsed(stop:Stop,used:Set<string>,catalog:Stop[]) {
  for(const key of stopConflictKeys(stop,catalog))used.add(key);
}
export function mentioned(stop:Stop,text:string) {
  const normalized=normalizePlaceName(text);
  return !!normalized&&[stop.name,...stop.aliases].some(n=>normalized.includes(normalizePlaceName(n)));
}
/** Regular hours only: absence means unknown, never open or available. */
export function visitStart(stop:Stop,date:string,earliest:number,latestEnd:number,duration=stop.minutes) {
  const h=stop.openingHours;
  if(h&&!h.weekdays.includes(new Date(date+"T12:00:00Z").getUTCDay()))return null;
  const start=Math.max(earliest,h?time(h.opens):earliest);
  return start+duration<=Math.min(latestEnd,h?time(h.closes):latestEnd)?start:null;
}
export function closeEnough(a:Stop,b:Stop) {
  if(a.cluster!==b.cluster)return false;
  if(a.lat===null||a.lng===null||b.lat===null||b.lng===null)return true;
  const x=(a.lng-b.lng)*Math.cos((a.lat+b.lat)*Math.PI/360);
  return Math.hypot(a.lat-b.lat,x)*111<=4;
}
export function addableStop(stop:Stop) {
  return stop.scheduling!=="manual"&&stop.mode!=="separate-base"&&!stop.componentOf.length;
}

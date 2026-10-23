import {readFileSync,readdirSync} from 'node:fs';
import {validatePhotoDecision} from './publish-place-photo-batch.mjs';
const root='docs/place-enrichment/cover-completion';
const baseline=JSON.parse(readFileSync(root+'/baseline.json','utf8'));
// Keep older preservation snapshots intact while permitting only the later,
// explicit approvals. Unapproved photos and changes to existing photos still fail.
const approvals=readdirSync(root).filter(n=>n.endsWith('-decisions.json')).flatMap(name=>JSON.parse(readFileSync(root+'/'+name,'utf8')).entries.filter(e=>e.approved));
approvals.forEach(validatePhotoDecision);
export const reviewedCoverAdditions=new Set(approvals.filter(e=>!baseline.photos[e.placeId]).map(e=>e.placeId));
/** @template {{placeId:string, photo?:unknown}} T @param {T[]} rows @returns {T[]} */
export function beforeCoverAdditions(rows){
 return rows.map(row=>{if(!reviewedCoverAdditions.has(row.placeId))return row;const copy={...row};delete copy.photo;return copy;});
}

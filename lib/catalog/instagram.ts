import raw from './place-instagram.json';
import {validateInstagramRecords,type InstagramRecord} from './instagram-schema';
export const placeInstagram=validateInstagramRecords(raw);
export const instagramForPlace=(id:string)=>placeInstagram.filter(r=>r.placeId===id);

/** The original post is a separate resource, never a cover photograph. */
export function selectInstagramCover(records:readonly InstagramRecord[],hasApprovedPhoto:boolean){
 return hasApprovedPhoto?undefined:records.find(r=>r.presentation==='manual-embed'&&r.review==='public-post'&&r.embedCheck.status!=='unavailable');
}
export const instagramCoverForPlace=(id:string,hasApprovedPhoto:boolean)=>selectInstagramCover(instagramForPlace(id),hasApprovedPhoto);

import raw from './place-instagram.json';
import {canonicalInstagramUrl,maxInstagramPosts,validateInstagramRecords,type InstagramRecord} from './instagram-schema';
export const placeInstagram=validateInstagramRecords(raw);
export const instagramForPlace=(id:string)=>placeInstagram.filter(r=>r.placeId===id);

export function selectInstagramGallery(records:readonly InstagramRecord[],cover?:{src:string;sourcePage?:string;creditUrl?:string}){
 const coverPost=canonicalInstagramUrl(cover?.sourcePage || cover?.creditUrl || '');
 const seen=new Set<string>(),assets=new Set(cover?[cover.src]:[]);
 return records.filter(post=>{
  const code=post.url.split('/').at(-2)!;
  const asset=post.photo?.asset.src;
  if(post.url===coverPost||seen.has(code)||(asset&&assets.has(asset)))return false;
  seen.add(code);
  if(asset)assets.add(asset);
  return true;
 }).slice(0,maxInstagramPosts);
}
export const instagramGalleryForPlace=(id:string,cover?:{src:string;sourcePage?:string;creditUrl?:string})=>selectInstagramGallery(instagramForPlace(id),cover);

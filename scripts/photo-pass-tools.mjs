// Public-source research helpers. Search results never constitute approval.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
export const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"').trim();
export const today=()=>new Date().toISOString().slice(0,10);
// Flickr's individual-photo license IDs, including the newer 4.0 options.
// https://www.flickr.com/services/api/flickr.photos.licenses.getInfo.html
export const flickrReusableLicenses={
 4:['CC BY 2.0','https://creativecommons.org/licenses/by/2.0/'],
 5:['CC BY-SA 2.0','https://creativecommons.org/licenses/by-sa/2.0/'],
 9:['CC0','https://creativecommons.org/publicdomain/zero/1.0/'],
 10:['Public domain','https://creativecommons.org/publicdomain/mark/1.0/'],
 11:['CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'],
 12:['CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'],
};
const root='work/photo-pass';await mkdir(root,{recursive:true});
export async function cached(url,type='json'){
 const path=`${root}/${createHash('sha256').update(url).digest('hex')}.${type==='json'?'json':'html'}`;
 try{if((await stat(path)).mtime.toISOString().slice(0,10)===today())return type==='json'?JSON.parse(await readFile(path,'utf8')):await readFile(path,'utf8');}catch{}
 const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LakbayPhotoReview/1.0 (https://lakbay-itinerary-planner-psi.vercel.app)'}});
 if(!r.ok){await r.body?.cancel();throw Error(`HTTP ${r.status}: ${url}`);}
 const text=await r.text();const value=type==='json'?JSON.parse(text):text;if(type==='json'&&value.error)throw Error(`Source API error: ${value.error.code}`);await writeFile(path,text);return value;
}
export function embeddedJson(s,marker){
 let start=s.indexOf(marker);if(start<0)throw Error('Public metadata not found');start=s.indexOf('{',start+marker.length);
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<s.length;i++){const c=s[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(s.slice(start,i+1));}
 throw Error('Incomplete public metadata');
}
export function flickrPhotos(html){
 const data=embeddedJson(html,'modelExport:'),found=new Map();
 function walk(n){if(!n||typeof n!=='object')return;if(['photo-models','photo-lite-models'].includes(n._flickrModelRegistry)&&n.id)found.set(n.id,n);for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(walk);else walk(v);}}
 walk(data);return [...found.values()];
}
export function flickrCandidate(p){
 const sizes=Object.values(p.sizes?.data||{}).map(s=>s.data).filter(s=>s?.url).sort((a,b)=>b.width-a.width);
 const best=sizes[0],preview=sizes.find(s=>s.width<=640)||best;
 return {provider:'Flickr',id:p.id,title:p.title,description:clean(p.description),creator:p.realname||p.username,owner:p.ownerNsid,sourcePage:`https://www.flickr.com/photos/${p.pathAlias||p.ownerNsid}/${p.id}/`,licenseCode:p.license,originalUrl:best?.url?.replace(/^\/\//,'https://'),previewUrl:preview?.url?.replace(/^\/\//,'https://'),width:best?.width,height:best?.height};
}
export async function commonsSearch(query){
 const url='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrsearch:query,gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata|size',iiurlwidth:'640'});
 const d=await cached(url);return {url,candidates:Object.values(d.query?.pages||{}).filter(p=>/\.(jpe?g|png|webp)$/i.test(p.title)).map(p=>{const i=p.imageinfo?.[0],m=i?.extmetadata||{};return {provider:'Wikimedia Commons',title:p.title,sourcePage:i?.descriptionurl,originalUrl:i?.url,previewUrl:i?.thumburl||i?.url,width:i?.width,height:i?.height,license:clean(m.LicenseShortName?.value),licenseUrl:m.LicenseUrl?.value,creator:clean(m.Artist?.value),description:clean(m.ImageDescription?.value),categories:clean(m.Categories?.value),latitude:m.GPSLatitude?.value,longitude:m.GPSLongitude?.value};})};
}
export async function flickrSearch(query){
 const url='https://www.flickr.com/search/?'+new URLSearchParams({text:query,license:Object.keys(flickrReusableLicenses).join(',')});
 const html=await cached(url,'html');return {url,candidates:flickrPhotos(html).map(flickrCandidate).slice(0,12)};
}

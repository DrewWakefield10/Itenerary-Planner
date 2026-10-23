// Research support only. Candidate metadata is NEVER automatically published.
import {mkdir,readFile,writeFile} from "node:fs/promises";
import sharp from "sharp";
const root="work/place-research";
await mkdir(root,{recursive:true});
const headers={"User-Agent":"LakbayCatalogReview/1.0 (https://lakbay-itinerary-planner-psi.vercel.app)"};
export async function get(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);return r;}
export async function wikiCandidate(placeId,title){
  const summary=await(await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)).json();
  const page=await(await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&titles=${encodeURIComponent(summary.title)}`)).json();
  const filename=Object.values(page.query.pages)[0]?.pageimage;
  let photo=null;
  if(filename){const file=await(await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&titles=${encodeURIComponent("File:"+filename)}`)).json();photo=Object.values(file.query.pages)[0]?.imageinfo?.[0]||null;}
  const result={placeId,title:summary.title,description:summary.description,extract:summary.extract,url:summary.content_urls?.desktop?.page,coordinates:summary.coordinates,photo};
  await writeFile(`${root}/${placeId}.json`,JSON.stringify(result,null,2)+"\n");return result;
}
const text=html=>String(html||"").replace(/<[^>]*>/g,"").replaceAll("&amp;","&").trim();
export async function downloadApprovedPhoto(placeId,alt){
  const candidate=JSON.parse(await readFile(`${root}/${placeId}.json`,"utf8")),p=candidate.photo,m=p?.extmetadata;
  if(!p||!m)throw new Error(`No reusable image candidate: ${placeId}`);
  const license=text(m.LicenseShortName?.value),licenseUrl=m.LicenseUrl?.value||(/^Public domain/i.test(text(m.LicenseShortName?.value))?p.descriptionurl:null);
  if(!/^(CC BY(?:-SA)? [1-4]\.0|CC0|Public domain)/i.test(license)||!licenseUrl)throw new Error(`License needs review: ${placeId}: ${license}`);
  // Request a bounded Commons rendition instead of downloading multi-megabyte
  // originals. Retain the original URL and rights metadata for attribution.
  const fileTitle=decodeURIComponent(new URL(p.descriptionurl).pathname.split('/wiki/')[1]);
  const rendition=await(await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1200&titles=${encodeURIComponent(fileTitle)}`)).json();
  const remote=Object.values(rendition.query.pages)[0]?.imageinfo?.[0];
  const downloadUrl=new URL(remote?.thumburl||p.url);downloadUrl.search='';
  const data=Buffer.from(await(await get(downloadUrl.href)).arrayBuffer());
  const creator=text(m.Artist?.value);
  return optimizeApprovedPhoto(placeId,data,{sourcePage:p.descriptionurl,originalUrl:p.url,creator,license,licenseUrl:licenseUrl.replace(/^http:/,"https:"),attribution:`${text(m.Attribution?.value)||creator} / Wikimedia Commons / ${license}. Resized and JPEG compressed.`,alt});
}
export async function optimizeApprovedPhoto(placeId,data,metadata){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(placeId))throw new Error('Invalid stable place ID');
  if(!metadata.creator||!metadata.alt||!metadata.attribution||!metadata.license)throw new Error('Incomplete approved image rights');
  for(const key of ['sourcePage','originalUrl','licenseUrl'])if(new URL(metadata[key]).protocol!=='https:')throw new Error('Image sources must use HTTPS');
  const src=`/images/places/${placeId}.jpg`,srcSmall=`/images/places/${placeId}-640.jpg`;
  await mkdir("public/images/places",{recursive:true});
  const info=await sharp(data).rotate().resize({width:1200,withoutEnlargement:true}).jpeg({quality:82,mozjpeg:true}).toFile("public"+src);
  await sharp(data).rotate().resize({width:640,withoutEnlargement:true}).jpeg({quality:80,mozjpeg:true}).toFile("public"+srcSmall);
  const {sourcePage,originalUrl,creator,license,licenseUrl,attribution,alt,objectPosition}=metadata;
  return {placeId,src,srcSmall,sourcePage,originalUrl,creator,license,licenseUrl,attribution,alt,...(objectPosition?{objectPosition}:{}),width:info.width,height:info.height,checkedOn:new Date().toISOString().slice(0,10)};
}
export async function videoCandidate(placeId,videoId){
  const url=`https://www.youtube.com/watch?v=${videoId}`;
  const metadata=await(await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)).json();
  const html=await(await get(url)).text();
  const match=html.match(/var ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
  let player=null;try{if(match)player=JSON.parse(match[1]);}catch{}
  const result={placeId,videoId,url,metadata,description:player?.videoDetails?.shortDescription||null,publishedOn:player?.microformat?.playerMicroformatRenderer?.publishDate||null,playability:player?.playabilityStatus?.status||null,embeddable:player?.playabilityStatus?.playableInEmbed??null,checkedOn:new Date().toISOString().slice(0,10)};
  await writeFile(`${root}/${placeId}-video-${videoId}.json`,JSON.stringify(result,null,2)+"\n");return result;
}
export async function videoSearchCandidates(placeId,query){
  const html=await(await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`)).text();
  const match=html.match(/var ytInitialData\s*=\s*(\{.*?\});<\/script>/s);
  if(!match)throw new Error("YouTube search metadata unavailable");
  const data=JSON.parse(match[1]),found=[];
  function walk(node){if(!node||typeof node!=="object")return;if(node.videoRenderer){const v=node.videoRenderer;found.push({videoId:v.videoId,title:v.title?.runs?.map(r=>r.text).join("")||v.title?.simpleText,creator:v.ownerText?.runs?.map(r=>r.text).join(""),description:v.detailedMetadataSnippets?.map(s=>s.snippetText?.runs?.map(r=>r.text).join("")).join(" ")});}else for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==="object")walk(value);}
  walk(data);
  const result={placeId,query,checkedOn:new Date().toISOString().slice(0,10),candidates:found.slice(0,12)};
  await writeFile(`${root}/${placeId}-video-search.json`,JSON.stringify(result,null,2)+"\n");return result;
}
export async function commonsSearchCandidates(placeId,query){
  const data=await(await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize`)).json();
  const result={placeId,query,checkedOn:new Date().toISOString().slice(0,10),candidates:Object.values(data.query?.pages||{}).filter(p=>!/[.]pdf$/i.test(p.title)).map(p=>({title:p.title,photo:p.imageinfo?.[0]}))};
  await writeFile(`${root}/${placeId}-commons-search.json`,JSON.stringify(result,null,2)+"\n");return result;
}
if(process.argv[2]==="wiki")console.log(JSON.stringify(await wikiCandidate(process.argv[3],process.argv.slice(4).join(" ")),null,2));
if(process.argv[2]==="video")console.log(JSON.stringify(await videoCandidate(process.argv[3],process.argv[4]),null,2));
if(process.argv[2]==="video-search")console.log(JSON.stringify(await videoSearchCandidates(process.argv[3],process.argv.slice(4).join(" ")),null,2));
if(process.argv[2]==="commons-search"){const r=await commonsSearchCandidates(process.argv[3],process.argv.slice(4).join(" "));console.log(JSON.stringify({placeId:r.placeId,query:r.query,candidates:r.candidates.map(c=>({title:c.title,license:c.photo?.extmetadata?.LicenseShortName?.value,description:c.photo?.extmetadata?.ImageDescription?.value?.slice(0,350)}))},null,2));}

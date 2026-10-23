// Fetch an individual image page and a preview for human review; never publishes.
import {writeFile,mkdir} from 'node:fs/promises';
import {cached,flickrPhotos,embeddedJson,clean,today} from './photo-pass-tools.mjs';
import {get} from './research-place-content.mjs';
import sharp from 'sharp';
export async function preparePhoto(placeId,sourcePage){
 const url=new URL(sourcePage);let photo,downloadUrl,previewUrl,evidence;
 if(url.hostname==='commons.wikimedia.org'){
  const title=decodeURIComponent(url.pathname.split('/wiki/')[1]);
  const api='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata|size',iiurlwidth:'1280',titles:title});
  const d=await cached(api),p=Object.values(d.query.pages)[0]?.imageinfo?.[0];if(!p)throw Error('Individual file source missing');
  // Review the actual file-page license declaration, not a site-wide footer.
  const parseUrl='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'parse',format:'json',page:title,prop:'wikitext'}),page=await cached(parseUrl);
  evidence={api,parseUrl,description:clean(p.extmetadata.ImageDescription?.value),categories:clean(p.extmetadata.Categories?.value),latitude:p.extmetadata.GPSLatitude?.value,longitude:p.extmetadata.GPSLongitude?.value,requiredAttribution:clean(p.extmetadata.Attribution?.value),licenseDeclaration:page.parse?.wikitext?.['*']};
  const m=p.extmetadata,creator=clean(m.Artist?.value),license=clean(m.LicenseShortName?.value),licenseUrl=(m.LicenseUrl?.value||(/^Public domain/.test(license)?p.descriptionurl:'')).replace(/^http:/,'https:');
  photo={sourcePage:p.descriptionurl,originalUrl:p.url,creator,license,licenseUrl:licenseUrl.replace(/\/deed\.[a-z-]+$/,'/'),attribution:`${clean(m.Attribution?.value)||creator} / Wikimedia Commons / ${license}. Resized and JPEG compressed.`};
  downloadUrl=(p.thumburl||p.url).split('?')[0];previewUrl=downloadUrl;
 }else if(url.hostname==='www.flickr.com'){
  const html=await cached(sourcePage,'html'),id=url.pathname.split('/').filter(Boolean).at(-1),p=flickrPhotos(html).find(p=>p.id===id);if(!p)throw Error('Individual Flickr photo metadata missing');
  const licenses={4:['CC BY 2.0','https://creativecommons.org/licenses/by/2.0/'],5:['CC BY-SA 2.0','https://creativecommons.org/licenses/by-sa/2.0/'],9:['CC0','https://creativecommons.org/publicdomain/zero/1.0/'],10:['Public domain','https://creativecommons.org/publicdomain/mark/1.0/']};
  const license=licenses[p.license];if(!license)throw Error(`Individual photo license is not approved: ${p.license}`);
  if(!html.includes(license[1]+'deed.en')&&!html.includes(license[1]+'"'))throw Error('Individual photo license link is unavailable');
  const owner=p.owner?.data;if(typeof owner!=='object')throw Error('Individual photographer identity missing');
  const creator=owner.realname||owner.username;
  const sizes=Object.values(p.sizes.data).map(s=>s.data).filter(s=>s?.url).sort((a,b)=>b.width-a.width),original=sizes.find(s=>s===p.sizes.data.o?.data)||sizes[0],delivery=sizes.find(s=>s.width>=1200&&s.width<=2048)||sizes.find(s=>s.width>=800)||sizes[0],preview=sizes.find(s=>s.width<=800)||delivery;
  const head=embeddedJson(html,'modelExport:').main['photo-head-meta-models']?.[0]?.data;
  evidence={title:p.title,creator,licenseCode:p.license,description:head?.['og:description'],keywords:head?.keywords,individualLicenseUrl:license[1],location:embeddedJson(html,'modelExport:').main['photo-location-models']?.[0]?.data?.text};
  photo={sourcePage,originalUrl:original.url.replace(/^\/\//,'https://'),creator,license:license[0],licenseUrl:license[1],attribution:`${creator} / Flickr / ${license[0]}. Resized and JPEG compressed.`};
  downloadUrl=delivery.url.replace(/^\/\//,'https://');previewUrl=preview.url.replace(/^\/\//,'https://');
 }else throw Error('Unsupported individual source');
 const result={placeId,checkedOn:today(),photo,downloadUrl,evidence,sourceReview:'Individual source/rights fetched; awaiting explicit visual and identity approval'};
 await mkdir('work/photo-pass/previews',{recursive:true});
 try{const preview=Buffer.from(await(await get(previewUrl)).arrayBuffer());await sharp(preview).rotate().resize({width:800,height:600,fit:'inside',withoutEnlargement:true}).jpeg().toFile(`work/photo-pass/previews/${placeId}.jpg`);}catch(e){result.previewError=e.message;}
 await writeFile(`work/photo-pass/${placeId}-prepared.json`,JSON.stringify(result,null,2)+'\n');
 return result;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/prepare-place-photo.mjs'))console.log(JSON.stringify(await preparePhoto(process.argv[2],process.argv[3]),null,2));

import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateInstagramRecords} from '../lib/catalog/instagram-schema';
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
type CatalogRow={id:string;image:unknown;destination_group:string;display_category:string;[key:string]:unknown};
type ChecklistRow={placeId:string;batchId:string;[key:string]:unknown};
type Source={url:string;status:number|null;error?:string;limitation:string};
type Research={records:{placeId:string;status:string;sources:Source[]}[]};
const root='docs/place-enrichment/instagram',catalog=await read('public/data/lakbay-locations.json') as CatalogRow[];
const resources=validateInstagramRecords(await read('lib/catalog/place-instagram.json'),new Set<string>(catalog.map((p:{id:string})=>p.id)));
const baseline=await read(root+'/preservation-baseline.json');
for(const file of baseline.files){if(createHash('sha256').update(await readFile(file.path)).digest('hex')!==file.sha256)throw Error('Preserved file changed: '+file.path);}
if(JSON.stringify(baseline.catalogIds)!==JSON.stringify(catalog.map((p:{id:string})=>p.id)))throw Error('Catalog identities changed');
if(JSON.stringify(baseline.approvedPhotos)!==JSON.stringify(catalog.filter((p:{image:unknown})=>p.image).map((p:{id:string;image:unknown})=>({placeId:p.id,image:p.image}))))throw Error('Approved photographs changed');
const checklist=await read(root+'/checklist.json') as {records:ChecklistRow[];startingPhotoGaps:number},reports:Research[]=[];
for(const file of (await readdir(root)).filter(n=>/^instagram-\d+-research.json$/.test(n)))reports.push(await read(root+'/'+file));
let decisions:{placeId:string;outcome:string;reason:string}[]=[];
try{decisions=await read(root+'/research-decisions.json');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const records=checklist.records.map((r:ChecklistRow)=>{
 const research=reports.flatMap(r=>r.records).find(p=>p.placeId===r.placeId),posts=resources.filter(p=>p.placeId===r.placeId),decision=decisions.find(d=>d.placeId===r.placeId);
 return {...r,status:posts.length?'selected':decision?.outcome||research?.status||'pending',instagramResources:posts.length,manualEmbeds:posts.filter(p=>p.presentation==='manual-embed').length,confirmedEmbeds:posts.filter(p=>p.embedCheck.status==='confirmed').length,linkOnly:posts.filter(p=>p.presentation==='link-only').length,publisherSourcesChecked:research?.sources.length||0,inaccessibleSources:research?.sources.filter(s=>s.status!==200).map(s=>({url:s.url,status:s.status,error:s.error||s.limitation}))||[],remaining:posts.length?'Individual embed availability can change.':decision?.reason||'Exact public-post identity review remains; no eligible post is inferred from an empty publisher search.'};
});
const summarize=(rows:typeof catalog)=>({locations:rows.length,approvedPhotos:rows.filter(p=>p.image).length,photoGaps:rows.filter(p=>!p.image).length,locationsWithInstagram:rows.filter(p=>resources.some(r=>r.placeId===p.id)).length,photoGapsWithInstagram:rows.filter(p=>!p.image&&resources.some(r=>r.placeId===p.id)).length,resources:resources.filter(r=>rows.some(p=>p.id===r.placeId)).length});
const counts=(key:'destination_group'|'display_category')=>Object.fromEntries([...new Set(catalog.map(p=>p[key]))].sort().map(group=>[group,summarize(catalog.filter(p=>p[key]===group))]));
const batches=[...new Set<string>(checklist.records.map(r=>r.batchId))].map(batchId=>{const entries=records.filter(r=>r.batchId===batchId);return{batchId,locations:entries.length,selected:entries.filter(r=>r.instagramResources).length,publisherAudited:entries.filter(r=>r.publisherSourcesChecked).length,inaccessibleSources:entries.reduce((n,r)=>n+r.inaccessibleSources.length,0),remainingExactPostReviews:entries.filter(r=>!r.instagramResources).length};});
const uniqueSources=[...new Map(reports.flatMap(r=>r.records.flatMap(p=>p.sources)).map(s=>[s.url,s])).values()];
const progress={updatedOn:new Date().toISOString().slice(0,10),scope:'All existing catalog categories. Public publisher-reference audit is separate from exact-post approval.',startingPhotoGaps:checklist.startingPhotoGaps,sourceAudit:{uniqueSources:uniqueSources.length,accessible:uniqueSources.filter(s=>s.status===200).length,inaccessible:uniqueSources.filter(s=>s.status!==200).length,locationsWithAllCatalogSourcesInaccessible:reports.flatMap(r=>r.records).filter(p=>p.sources.every(s=>s.status!==200)).length,limitation:'Static public publisher references only. An empty result does not establish that no suitable Instagram post exists; broader individual-post discovery remains for uncovered places.'},totals:{...summarize(catalog),manualEmbedResources:resources.filter(r=>r.presentation==='manual-embed').length,confirmedWorkingEmbeds:resources.filter(r=>r.embedCheck.status==='confirmed').length,externalLinkOnly:resources.filter(r=>r.presentation==='link-only').length,publisherAudited:records.filter(r=>r.publisherSourcesChecked).length,remainingWithoutApprovedInstagram:records.filter(r=>!r.instagramResources).length},byDestination:counts('destination_group'),byCategory:counts('display_category'),batches,records};
await writeFile(root+'/checklist.json',JSON.stringify({...checklist,records},null,2)+'\n');
await writeFile('public/data/instagram-progress.json',JSON.stringify(progress,null,2)+'\n');
await writeFile('public/data/lakbay-instagram.json',JSON.stringify(resources,null,2)+'\n');
const columns=['placeId','url','account','accountName','relevance','checkedOn','review','presentation','embedCheck','evidenceUrls','limitation'] as const;
const cell=(v:unknown)=>'"'+(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll('"','""')+'"';
await writeFile('public/data/lakbay-instagram.csv','\uFEFF'+[columns.join(','),...resources.map(r=>columns.map(c=>cell(r[c])).join(','))].join('\r\n')+'\r\n');
const table=(groups:ReturnType<typeof counts>)=>Object.entries(groups).map(([group,c])=>`| ${group} | ${c.locations} | ${c.approvedPhotos} | ${c.photoGaps} | ${c.locationsWithInstagram} | ${c.resources} | ${c.photoGapsWithInstagram} |`);
await writeFile(root+'/coverage.md',[
 '# Instagram coverage', '',`Generated ${progress.updatedOn} (UTC review dates). ${progress.totals.resources} resources for ${progress.totals.locationsWithInstagram}/${catalog.length} locations. ${progress.totals.confirmedWorkingEmbeds} confirmed working embeds at their recorded checks; ${progress.totals.externalLinkOnly} link-only resources.`,
 '',`Licensed photographs remain ${progress.totals.approvedPhotos}/${catalog.length}; starting and final photo gaps: ${checklist.startingPhotoGaps}. ${progress.totals.photoGapsWithInstagram} places with missing photos now have an Instagram resource. The other ${progress.totals.remainingWithoutApprovedInstagram} locations still have no approved Instagram resource.`,
 '', '## By browsing destination','', '| Destination | Locations | Photos | Photo gaps | Places with Instagram | Posts | Photo gaps with Instagram |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |',...table(progress.byDestination),
 '', '## By display category','', '| Category | Locations | Photos | Photo gaps | Places with Instagram | Posts | Photo gaps with Instagram |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |',...table(progress.byCategory),
 '',`The catalog-source audit covers ${progress.totals.publisherAudited} locations in 20-location batches (last batch: 6). ${uniqueSources.length} unique sources were attempted; ${progress.sourceAudit.inaccessible} were inaccessible. ${progress.sourceAudit.locationsWithAllCatalogSourcesInaccessible} locations had no accessible catalog source in this pass. Separate public travel/venue articles supplied the reviewed candidates.`,
 '', 'A publisher reference is not approval. The checklist retains exact-post research gaps, inaccessible sources and the source-limited scope. No suitable post found in reviewed pages is not proof that Instagram contains none. See README.md, candidate-decisions.json, supplemental-research.json and the individual research/decision batches.','',
 ].join('\n'));
console.log(JSON.stringify(progress.totals));

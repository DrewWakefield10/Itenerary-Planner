import {readFile,writeFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8')),save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const root='docs/place-enrichment/photo-only',check=await read(`${root}/checklist.json`),progress=await read('public/data/place-enrichment-progress.json');
const pending=check.records.filter(r=>r.status==='pending'),added=check.records.filter(r=>r.status==='added'),remaining=check.records.filter(r=>r.status!=='added');
const coverage=[...new Set(progress.records.map(r=>r.destination))].map(destination=>{
 const rows=progress.records.filter(r=>r.destination===destination),newRows=added.filter(r=>r.destination===destination);
 return {destination,total:rows.length,startingPhotos:rows.filter(r=>r.image!=='gap').length-newRows.length,added:newRows.length,finalPhotos:rows.filter(r=>r.image!=='gap').length,remaining:rows.filter(r=>r.image==='gap').length};
});
const batches=[...new Set(check.records.map(r=>r.batch))].map(id=>({id,size:check.records.filter(r=>r.batch===id).length,reviewed:check.records.filter(r=>r.batch===id&&r.status!=='pending').length,added:added.filter(r=>r.batch===id).length}));
progress.photoPass={startedOn:check.startedOn,startingGaps:check.startingGaps,startingCoverage:check.startingPhotoCoverage,reviewed:check.records.length-pending.length,photographsAdded:added.length,finalCoverage:progress.catalogSize-remaining.length,remainingGaps:remaining.length,status:pending.length?'in-progress':check.validation?'reviewed-with-content-gaps':'data-reviewed-awaiting-final-checks',batches,coverage,checklist:`${root}/checklist.json`,suppliedPhotoList:`${root}/needs-supplied-photos.json`,permissionGuide:`${root}/supplied-photo-guide.md`,validation:check.validation||null,nextBatch:pending[0]?.batch||null};
progress.remainingWork=progress.remainingWork.map(s=>/^\d+ places still need an exact-place photograph/.test(s)?`${remaining.length} places still need an exact-place photograph with documented reuse rights; the targeted 148-place pass added ${added.length}. See docs/place-enrichment/photo-only/.`:s);
await save('public/data/place-enrichment-progress.json',progress);
const gaps=await read('docs/place-enrichment/remaining-gaps.json');
gaps.photoUpdatedOn=new Date().toISOString().slice(0,10);gaps.photoGaps=progress.records.filter(r=>r.image==='gap').map(r=>({placeId:r.placeId,name:r.name,destination:r.destination,notes:r.notes,photoResearch:r.photoResearch}));
await save('docs/place-enrichment/remaining-gaps.json',gaps);
await save(`${root}/needs-supplied-photos.json`,{generatedOn:new Date().toISOString().slice(0,10),scope:'Current unresolved gaps after the targeted photo pass. This is not a claim that no licensed photograph exists anywhere. Some source files remain inaccessible or have unresolved identity.',count:remaining.length,requiredInformation:['placeId','imageFile','photographerOrRightsHolder','permissionForWebsitePublicationAndResizingCropping','attributionPreference'],guide:'supplied-photo-guide.md',records:remaining.map(r=>({placeId:r.placeId,name:r.name,destination:r.destination,municipality:r.municipality,status:r.status,reason:r.reason||r.blocker,sourcesSearched:r.sourcesSearched,rejections:r.rejections,notes:r.notes,suppliedPhoto:{imageFile:null,photographerOrRightsHolder:null,permissionForWebsitePublicationAndResizingCropping:null,attributionPreference:null}}))});
const cell=s=>String(s).replaceAll('|','\\|').replace(/\s+/g,' ');
await writeFile(`${root}/needs-supplied-photos.md`,[
 '# Remaining photo checklist','',
 `${remaining.length} places remain without an approved usable photograph after reviewing the original ${check.startingGaps} gaps. Supply an exact-place photo with the [required rights information](supplied-photo-guide.md), or resolve a recorded licensed candidate’s identity/file-access issue. No permission request has been sent.`,
 '', 'Full source searches, candidate rejections and uncertainty are in [the JSON checklist](needs-supplied-photos.json) and linked batch decisions.', '',
 '| Destination | Place | City / municipality | Stable place ID | Review |',
 '| --- | --- | --- | --- | --- |',
 ...remaining.map(r=>`| ${cell(r.destination)} | ${cell(r.name)} | ${cell(r.municipality)} | ${r.placeId} | [Decision](${r.batch}-decisions.json) |`),'',
].join('\n'));
await save(`${root}/summary.json`,progress.photoPass);
console.table(coverage);console.log({startingGaps:check.startingGaps,reviewed:check.records.length-pending.length,added:added.length,remaining:remaining.length});

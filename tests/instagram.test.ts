import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalInstagramUrl,instagramRecordSchema,validateInstagramRecords} from '../lib/catalog/instagram-schema';
import {placeInstagram,instagramForPlace,instagramCoverForPlace,selectInstagramCover} from '../lib/catalog/instagram';
import {directoryListings} from '../lib/catalog/directory';
import {publishInstagramBatch} from '../scripts/publish-instagram-batch';

test('Instagram accepts canonical post/reel URLs and rejects profiles, scripts and lookalikes',()=>{
 assert.equal(canonicalInstagramUrl('https://instagram.com/p/Abc_123-/?utm_source=test#fragment'),'https://www.instagram.com/p/Abc_123-/');
 assert.equal(canonicalInstagramUrl('https://www.instagram.com/reel/Abc_123-/'),'https://www.instagram.com/reel/Abc_123-/');
 for(const url of ['http://instagram.com/p/Abc123/','https://instagram.com.evil.test/p/Abc123/','https://evil.test/instagram.com/p/Abc123/','javascript:alert(1)','<script src="https://instagram.com/embed.js"></script>','https://www.instagram.com/user/','https://www.instagram.com/stories/user/123/','https://user:secret@instagram.com/p/Abc123/','https://instagram.com:444/p/Abc123/'])assert.equal(canonicalInstagramUrl(url),null,url);
});
test('Instagram collection uses exact stable IDs, unique posts and at most three per location',()=>{
 assert.ok(placeInstagram.length>=5);
 assert.deepEqual(validateInstagramRecords(placeInstagram,new Set(directoryListings.map(p=>p.id))),placeInstagram);
 const record=placeInstagram[0];
 assert.throws(()=>validateInstagramRecords([record,record]),/Duplicate/);
 assert.throws(()=>validateInstagramRecords([record],new Set(['unknown'])),/Unknown/);
 assert.throws(()=>validateInstagramRecords([1,2,3,4].map(n=>({...record,url:`https://www.instagram.com/p/Test00${n}/` }))),/three/);
 assert.deepEqual(instagramForPlace('legacy-no-instagram'),[]);
});
test('Detail covers prefer approved photographs and only select reviewed, embeddable original posts',()=>{
 const record=instagramForPlace('siargao-spotted-pig-catangnan')[0];
 assert.equal(instagramCoverForPlace(record.placeId,true),undefined);
 assert.equal(instagramCoverForPlace(record.placeId,false)?.url,record.url);
 assert.equal(instagramCoverForPlace('unknown-place',false),undefined);
 const unavailable={...record,presentation:'link-only' as const,embedCheck:{...record.embedCheck,status:'unavailable' as const}};
 assert.equal(selectInstagramCover([unavailable],false),undefined);
 assert.equal(selectInstagramCover([{...record,review:'publisher-reference'}],false),undefined);
 assert.equal(selectInstagramCover([unavailable,record],false)?.url,record.url);
});
test('Unreviewed HTML, future checks and unsupported embed claims are rejected',()=>{
 const record=placeInstagram[0];
 assert.equal(instagramRecordSchema.safeParse({...record,html:'<script>alert(1)</script>'}).success,false);
 assert.equal(instagramRecordSchema.safeParse({...record,checkedOn:'2099-01-01'}).success,false);
 assert.equal(instagramRecordSchema.safeParse({...record,checkedOn:'2026-02-30'}).success,false);
 assert.equal(instagramRecordSchema.safeParse({...record,review:'publisher-reference',presentation:'manual-embed'}).success,false);
 assert.equal(instagramRecordSchema.safeParse({...record,embedCheck:{...record.embedCheck,status:'confirmed',checkedOn:null}}).success,false);
 assert.equal(instagramRecordSchema.safeParse({...record,embedCheck:{...record.embedCheck,status:'unavailable'}}).success,false);
 assert.equal(instagramRecordSchema.safeParse({...record,presentation:'link-only',embedCheck:{...record.embedCheck,status:'unavailable'}}).success,true);
});
test('Instagram enrichment preserves catalog identities and licensed photos, descriptions and videos',()=>{
 const baseline=JSON.parse(readFileSync('docs/place-enrichment/instagram/preservation-baseline.json','utf8'));
 for(const entry of baseline.files)assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'),entry.sha256,entry.path);
 assert.deepEqual(directoryListings.map(p=>p.id),baseline.catalogIds);
 const exported=JSON.parse(readFileSync('public/data/lakbay-locations.json','utf8')) as {id:string;image:unknown}[];
 assert.deepEqual(exported.filter(p=>p.image).map(p=>({placeId:p.id,image:p.image})),baseline.approvedPhotos);
 for(const post of placeInstagram)assert.ok(!('photo' in post)&&!('image' in post));
});
test('Reviewed publishing rejects unapproved input before changing the Instagram overlay',async()=>{
 const before=readFileSync('lib/catalog/place-instagram.json','utf8');
 await assert.rejects(publishInstagramBatch({mode:'instagram-only',batchId:'instagram-unreviewed',checkedOn:new Date().toISOString().slice(0,10),entries:[{placeId:placeInstagram[0].placeId,decision:'candidate',identityReviewed:false,posts:[placeInstagram[0]]}]}));
 assert.equal(readFileSync('lib/catalog/place-instagram.json','utf8'),before);
});
test('Directory exports retain Instagram metadata without changing licensed photo coverage',()=>{
 const rows=JSON.parse(readFileSync('public/data/lakbay-locations.json','utf8')) as {id:string;image:unknown;instagram:typeof placeInstagram}[];
 for(const row of rows)assert.deepEqual(row.instagram,instagramForPlace(row.id));
 assert.equal(rows.filter(r=>r.image).length,214);
 const progress=JSON.parse(readFileSync('public/data/instagram-progress.json','utf8'));
 assert.equal(progress.totals.photoGaps,212);
 assert.equal(progress.totals.resources,placeInstagram.length);
 assert.equal(progress.totals.photoGapsWithInstagram,rows.filter(r=>!r.image&&r.instagram.length).length);
});

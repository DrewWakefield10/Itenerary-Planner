import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalInstagramUrl,instagramRecordSchema,validateInstagramRecords} from '../lib/catalog/instagram-schema';
import {placeInstagram,instagramForPlace,instagramGalleryForPlace,selectInstagramGallery} from '../lib/catalog/instagram';
import {directoryListings} from '../lib/catalog/directory';
import {publishInstagramBatch} from '../scripts/publish-instagram-batch';
import {beforeCoverAdditions,reviewedCoverAdditions} from './helpers/cover-preservation';

test('Instagram accepts canonical post/reel URLs and rejects profiles, scripts and lookalikes',()=>{
 assert.equal(canonicalInstagramUrl('https://instagram.com/p/Abc_123-/?utm_source=test#fragment'),'https://www.instagram.com/p/Abc_123-/');
 assert.equal(canonicalInstagramUrl('https://www.instagram.com/reel/Abc_123-/'),'https://www.instagram.com/reel/Abc_123-/');
 for(const url of ['http://instagram.com/p/Abc123/','https://instagram.com.evil.test/p/Abc123/','https://evil.test/instagram.com/p/Abc123/','javascript:alert(1)','<script src="https://instagram.com/embed.js"></script>','https://www.instagram.com/user/','https://www.instagram.com/stories/user/123/','https://user:secret@instagram.com/p/Abc123/','https://instagram.com:444/p/Abc123/'])assert.equal(canonicalInstagramUrl(url),null,url);
});
test('Instagram collection uses exact stable IDs, unique posts and at most five per location',()=>{
 assert.ok(placeInstagram.length>=5);
 assert.deepEqual(validateInstagramRecords(placeInstagram,new Set(directoryListings.map(p=>p.id))),placeInstagram);
 const record=placeInstagram[0];
 assert.throws(()=>validateInstagramRecords([record,record]),/Duplicate/);
 assert.throws(()=>validateInstagramRecords([record],new Set(['unknown'])),/Unknown/);
 assert.throws(()=>validateInstagramRecords([1,2,3,4,5,6].map(n=>({...record,url:`https://www.instagram.com/p/Test00${n}/` }))),/five/);
 assert.deepEqual(instagramForPlace('legacy-no-instagram'),[]);
});
test('Gallery slides preserve link-only posts and exclude a duplicate approved cover',()=>{
 const record=instagramForPlace('siargao-spotted-pig-catangnan')[0];
 const other={...record,url:'https://www.instagram.com/p/Test002/',presentation:'link-only' as const};
 assert.deepEqual(selectInstagramGallery([record,{...record,url:record.url.replace('/p/','/reel/')},other]),[record,other]);
 assert.deepEqual(selectInstagramGallery([record,other],{src:'/images/cover.webp',sourcePage:record.url}),[other]);
 assert.deepEqual(instagramGalleryForPlace('unknown-place'),[]);
});
test('Inline Instagram images require evidence and a reviewed file rather than a CDN image',()=>{
 const record=placeInstagram[0];
 const asset={placeId:record.placeId,src:'/images/fixture.webp',sourcePage:record.url,
 originalUrl:'https://rights-holder.example/fixture.webp',creator:'Fixture',license:'Test only',licenseUrl:'https://rights-holder.example/license',
 attribution:'Fixture credit',alt:'Test fixture illustration',width:960,height:640,checkedOn:record.checkedOn};
 const photo={asset,permission:'documented-permission',evidence:'Fixture of documented permission to publish.'};
 assert.equal(instagramRecordSchema.safeParse({...record,photo}).success,true);
 for(const bad of [{...photo,evidence:''},{...photo,asset:{...asset,placeId:'different-place'}},{...photo,asset:{...asset,originalUrl:'https://scontent.cdninstagram.com/test.jpg'}}])
  assert.equal(instagramRecordSchema.safeParse({...record,photo:bad}).success,false);
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
 for(const entry of baseline.files){
  const bytes=entry.path==='lib/catalog/place-content.json'?JSON.stringify(beforeCoverAdditions(JSON.parse(readFileSync(entry.path,'utf8'))),null,2)+'\n':readFileSync(entry.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
 }
 assert.deepEqual(directoryListings.map(p=>p.id),baseline.catalogIds);
 const exported=JSON.parse(readFileSync('public/data/lakbay-locations.json','utf8')) as {id:string;image:unknown}[];
 assert.deepEqual(exported.filter(p=>p.image&&!reviewedCoverAdditions.has(p.id)).map(p=>({placeId:p.id,image:p.image})),baseline.approvedPhotos);
 for(const post of placeInstagram)assert.ok(!('image' in post));
});
test('Reviewed publishing rejects unapproved input before changing the Instagram overlay',async()=>{
 const before=readFileSync('lib/catalog/place-instagram.json','utf8');
 await assert.rejects(publishInstagramBatch({mode:'instagram-only',batchId:'instagram-unreviewed',checkedOn:new Date().toISOString().slice(0,10),entries:[{placeId:placeInstagram[0].placeId,decision:'candidate',identityReviewed:false,posts:[placeInstagram[0]]}]}));
 assert.equal(readFileSync('lib/catalog/place-instagram.json','utf8'),before);
});
test('Directory exports keep Instagram separate from independently approved photo additions',()=>{
 const rows=JSON.parse(readFileSync('public/data/lakbay-locations.json','utf8')) as {id:string;image:unknown;instagram:typeof placeInstagram}[];
 for(const row of rows)assert.deepEqual(row.instagram,instagramForPlace(row.id));
 const baseline=JSON.parse(readFileSync('docs/place-enrichment/instagram/preservation-baseline.json','utf8'));
 assert.equal(rows.filter(r=>r.image).length,baseline.approvedPhotos.length+reviewedCoverAdditions.size);
 const progress=JSON.parse(readFileSync('public/data/instagram-progress.json','utf8'));
 assert.equal(progress.totals.photoGaps,rows.filter(r=>!r.image).length);
 assert.equal(progress.totals.resources,placeInstagram.length);
 assert.equal(progress.totals.photoGapsWithInstagram,rows.filter(r=>!r.image&&r.instagram.length).length);
});

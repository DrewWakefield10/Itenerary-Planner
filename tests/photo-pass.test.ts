import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePhotoDecision} from '../scripts/publish-place-photo-batch.mjs';
import {placeContents} from '../lib/catalog/place-content';
import {flickrReusableLicenses} from '../scripts/photo-pass-tools.mjs';
import {reviewedCoverAdditions} from './helpers/cover-preservation';

test('Flickr research includes reusable 4.0 licenses and excludes restricted licenses',()=>{
 assert.deepEqual(flickrReusableLicenses[11],['CC BY 4.0','https://creativecommons.org/licenses/by/4.0/']);
 assert.deepEqual(flickrReusableLicenses[12],['CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/']);
 for(const restricted of [0,1,2,3,6,7,8,13,14,15,16])assert.equal(Object.hasOwn(flickrReusableLicenses,restricted),false);
});

test('cover follow-up preserves all prior photographs, descriptions and unrelated catalog data',()=>{
 const baseline=JSON.parse(readFileSync('docs/place-enrichment/cover-completion/baseline.json','utf8'));
 const raw=JSON.parse(readFileSync('lib/catalog/place-content.json','utf8'));
 assert.equal(hash(JSON.stringify(raw.map((row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='photo'))))),baseline.nonPhotoHash);
 for(const [id,photo]of Object.entries(baseline.photos))assert.deepEqual(placeContents.find(p=>p.placeId===id)?.photo,photo);
 for(const [path,digest]of Object.entries(baseline.files))assert.equal(hash(readFileSync(path)),digest,path);
 for(const [path,digest]of Object.entries(baseline.photoAssetHashes))assert.equal(hash(readFileSync('public'+path)),digest,path);
 assert.deepEqual(new Set(raw.filter((p:{placeId:string;photo?:unknown})=>p.photo&&!baseline.photos[p.placeId]).map((p:{placeId:string})=>p.placeId)),reviewedCoverAdditions);
});

const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
test('photo-only enrichment leaves approved text, videos, original catalog and existing photo files unchanged',()=>{
 const baseline=JSON.parse(readFileSync('docs/place-enrichment/photo-only/baseline.json','utf8'));
 const raw=JSON.parse(readFileSync('lib/catalog/place-content.json','utf8'));
 // Later reviewed catalog batches may append content; the original photo-only
 // pass's complete 332-record prefix must still be byte-equivalent without photos.
 assert.ok(raw.length>=baseline.catalogSize);
 assert.equal(hash(JSON.stringify(raw.slice(0,baseline.catalogSize).map((row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='photo'))))),baseline.nonPhotoContentHash);
 assert.equal(hash(readFileSync('lib/catalog/place-videos.json')),baseline.videosHash);
 for(const [id,photo]of Object.entries(baseline.photos))assert.deepEqual(placeContents.find(p=>p.placeId===id)?.photo,photo);
 for(const [path,digest]of Object.entries(baseline.photoAssetHashes))assert.equal(hash(readFileSync('public'+path)),digest,path);
 for(const [path,digest]of Object.entries(baseline.directoryHashes))assert.equal(hash(readFileSync('lib/catalog/'+path)),digest,path);
});

test('photo publication requires explicit visual, identity and individual-license review',()=>{
 const decision={placeId:'example-place',approved:true,visuallyReviewed:true,licenseReviewed:true,identityEvidence:['https://commons.wikimedia.org/wiki/File:Example.jpg'],photo:{creator:'Photographer',alt:'Actual place frontage',attribution:'Photographer / CC BY 4.0. Resized.',sourcePage:'https://commons.wikimedia.org/wiki/File:Example.jpg',originalUrl:'https://upload.wikimedia.org/example.jpg',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'}};
 assert.doesNotThrow(()=>validatePhotoDecision(decision));
 assert.throws(()=>validatePhotoDecision({...decision,visuallyReviewed:false}),/review/);
 assert.throws(()=>validatePhotoDecision({...decision,licenseReviewed:false}),/review/);
 assert.throws(()=>validatePhotoDecision({...decision,identityEvidence:[]}),/review/);
 for(const license of ['All rights reserved','CC BY-NC 4.0','CC BY-ND 4.0'])assert.throws(()=>validatePhotoDecision({...decision,photo:{...decision.photo,license}}),/License/);
 assert.throws(()=>validatePhotoDecision({...decision,photo:{...decision.photo,licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'}}),/License/);
 assert.doesNotThrow(()=>validatePhotoDecision({...decision,photo:{...decision.photo,sourcePage:'https://www.flickr.com/photos/photographer/123/',originalUrl:'https://live.staticflickr.com/example.jpg',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/'}}));
 assert.throws(()=>validatePhotoDecision({...decision,downloadUrl:'https://unreviewed.example/photo.jpg'}),/delivery host/);
});

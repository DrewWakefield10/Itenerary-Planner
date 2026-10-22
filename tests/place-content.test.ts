import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {placeContents,placeVideos,videosForPlace,videoEmbedUrl} from "../lib/catalog/place-content";
import {placeContentSchema,placeVideoSchema} from "../lib/catalog/place-content-schema";
import {directoryListings,filterDirectory} from "../lib/catalog/directory";
import {discoveryPlace,discoveryStop} from "../lib/discovery";
import {generateDemo} from "../lib/engine";
import {defaultRequest,tripSchema} from "../lib/trip";

test("place content keeps stable identity, reusable image metadata and separate fact sources",()=>{
  assert.equal(new Set(placeContents.map(p=>p.placeId)).size,placeContents.length);
  for(const p of placeContents){
    placeContentSchema.parse(p);assert.ok(directoryListings.some(d=>d.id===p.placeId));
    if(p.photo){assert.equal(p.photo.placeId,p.placeId);assert.ok(existsSync("public"+p.photo.src));assert.ok(p.photo.creator);assert.ok(/CC|Public domain/.test(p.photo.license));assert.ok(new URL(p.photo.originalUrl).hostname.endsWith("wikimedia.org"));}
    assert.equal(discoveryPlace(p.placeId)!.description,p.summary);
    assert.equal(discoveryPlace(p.placeId)!.source.status,directoryListings.find(d=>d.id===p.placeId)!.sources.identity.status);
  }
});
test("videos only match their place IDs, cannot inject embeds and retain honest review limitations",()=>{
  assert.equal(new Set(placeVideos.map(v=>`${v.placeId}:${v.videoId}`)).size,placeVideos.length);
  for(const video of placeVideos){
    placeVideoSchema.parse(video);assert.ok(directoryListings.some(p=>p.id===video.placeId));
    assert.ok(videosForPlace(video.placeId).every(v=>v.placeId===video.placeId&&v.status==="available"));
    const embed=new URL(videoEmbedUrl(video));assert.equal(embed.hostname,"www.youtube-nocookie.com");assert.equal(embed.searchParams.has("autoplay"),false);
    assert.ok(video.limitation);assert.equal(placeVideoSchema.safeParse({...video,videoId:'bad-id" onload="x'}).success,false);
    assert.equal(placeVideoSchema.safeParse({...video,url:'https://evil.example/watch?v='+video.videoId}).success,false);
    assert.equal(placeVideoSchema.safeParse({...video,checkedOn:'2026-02-31'}).success,false);
  }
  assert.deepEqual(videosForPlace("not-a-real-place"),[]);
});
test("display enrichment composes with search and never rewrites catalog facts or saved snapshots",()=>{
  const original=directoryListings.find(p=>p.id==="iloilo-jaro-plaza-heritage-area")!;
  assert.equal(original.description,"A historic public square in Jaro.");
  assert.ok(filterDirectory({group:"Iloilo",category:"Parks & markets",search:"bandstand"}).some(p=>p.id===original.id));
  const trip=generateDemo({...defaultRequest,destinations:["baguio"],days:3,startDate:"2026-12-10"}),saved=JSON.stringify(trip);
  for(const place of placeContents){const display=discoveryPlace(place.placeId)!;discoveryStop(display);videosForPlace(place.placeId);}
  assert.equal(JSON.stringify(tripSchema.parse(JSON.parse(saved))),saved);
  const exports=JSON.parse(readFileSync("public/data/lakbay-locations.json","utf8"));
  assert.equal(exports.length,directoryListings.length);
  for(const row of exports){
    const content=placeContents.find(p=>p.placeId===row.id);
    if(!content)continue;
    assert.equal(row.card_summary,content.summary);
    assert.deepEqual(row.overview,content.overview);
    assert.deepEqual(row.content_sources,content.sources);
    assert.deepEqual(row.videos,videosForPlace(row.id));
    if(content.photo)assert.equal(row.image.originalUrl,content.photo.originalUrl);
  }
});

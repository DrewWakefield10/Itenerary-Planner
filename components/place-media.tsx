"use client";
import {useState} from "react";
import {Compass} from "lucide-react";
import type {DiscoveryPlace} from "@/lib/discovery";
import {videosForPlace,videoEmbedUrl} from "@/lib/catalog/place-content";
import {SourceIndicator} from "./source-indicator";

export function PlacePhoto({place,prominent=false}:{place:DiscoveryPlace;prominent?:boolean}){
  const [failed,setFailed]=useState(false),photo=place.image;
  return photo&&!failed?<img className="place-photo" src={photo.src} alt={photo.alt}
    ref={img=>{if(img?.complete&&img.naturalWidth===0)setFailed(true);}}
    width={photo.width||1200} height={photo.height||800}
    srcSet={photo.srcSmall&&photo.width&&photo.width>640?`${photo.srcSmall} 640w, ${photo.src} ${photo.width}w`:undefined}
    sizes={photo.srcSmall&&photo.width&&photo.width>640?prominent?"(max-width: 650px) 100vw, 48vw":"(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 33vw":undefined}
    loading={prominent?"eager":"lazy"} decoding="async" style={{objectPosition:photo.objectPosition||"50% 50%"}}
    onError={()=>setFailed(true)}/>:<div className="discovery-art place-photo-fallback" role="img" aria-label={`Photograph unavailable for ${place.name}`}>
      <Compass size={62} strokeWidth={1} aria-hidden="true"/><span>{place.name}</span><small>Place photograph not available</small>
    </div>;
}
export function PlaceVideos({placeId}:{placeId:string}){
  const videos=videosForPlace(placeId);
  if(!videos.length)return null;
  return <section className="discovery-section place-videos" aria-labelledby="place-videos-title">
    <h2 id="place-videos-title">Watch before <em>you visit.</em></h2>
    <p>See the setting through another visitor’s camera. Recordings show a moment in time; current access, prices and conditions may differ.</p>
    <div className="place-video-grid">{videos.map(video=><article key={video.videoId}>
      <div className="place-video-player"><iframe src={videoEmbedUrl(video)} title={`${video.title} — ${video.creator}`} loading="lazy"
        allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>
      <h3>{video.title}</h3><p>{video.relevance}</p>
      <p className="fine-print"><a href={video.creatorUrl||video.url} target="_blank" rel="noreferrer">{video.creator}</a>{video.publishedOn?` · Published ${video.publishedOn}`:" · Publication date not verified"}</p>
      <a className="text-link" href={video.startSeconds?`${video.url}&t=${video.startSeconds}s`:video.url} target="_blank" rel="noreferrer">Open on YouTube ↗</a>
      <p className="fine-print">If the player is unavailable, use the YouTube link. Source checked {video.checkedOn}.</p>
      <details className="place-video-review"><summary>About this video check</summary><p>{video.limitation}</p></details>
    </article>)}</div>
  </section>;
}
export function PlaceOverview({place}:{place:DiscoveryPlace}){
  const content=place.editorial;
  return <section className="discovery-section place-overview" aria-labelledby="place-overview-title">
    <h2 id="place-overview-title">A little <em>closer.</em></h2>
    {(content?.overview||[place.description]).map((text,i)=><p key={i}>{text}</p>)}
    {!!content?.highlights.length&&<><h3>Highlights</h3><ul>{content.highlights.map(h=><li key={h.text}>{h.text}</li>)}</ul></>}
  </section>;
}
export function PlaceEditorialCredits({place}:{place:DiscoveryPlace}){
  const content=place.editorial,photo=content?.photo;
  return <>
    {place.directory&&<div className="place-geography-sources">{Object.entries(place.directory.sources).map(([key,source])=><p key={key}><strong>{key==="municipality"?"Municipality":key[0].toUpperCase()+key.slice(1)}: </strong><SourceIndicator source={source} label={key==="municipality"?"Municipality":key}/></p>)}</div>}
    {!!content?.sources.length&&<ul className="place-source-list">{content.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a><p>{s.supports} · Reviewed {s.checkedOn}</p></li>)}</ul>}
    {photo?<div className="place-image-credit"><h3>Photograph</h3><p>{photo.attribution}</p><p><a href={photo.sourcePage} target="_blank" rel="noreferrer">Source page</a> · <a href={photo.originalUrl} target="_blank" rel="noreferrer">Original image</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></p><p className="fine-print">Photo associated with {place.name}; reuse metadata checked {photo.checkedOn}. Photographs do not establish current conditions.</p></div>
      :place.image?<p><a href={place.image.creditUrl}>Existing photo source and reuse license ↗</a></p>:<p>No photograph with documented reuse rights has been added for this place.</p>}
  </>;
}

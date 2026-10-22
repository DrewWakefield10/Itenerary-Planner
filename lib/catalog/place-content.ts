import content from "./place-content.json";
import videoRecords from "./place-videos.json";
import {placeContentSchema,placeVideoSchema} from "./place-content-schema";
export const placeContents=content.map(p=>placeContentSchema.parse(p));
export const placeVideos=videoRecords.map(v=>placeVideoSchema.parse(v));
export const placeContent=(id:string)=>placeContents.find(p=>p.placeId===id);
export const videosForPlace=(id:string)=>placeVideos.filter(v=>v.placeId===id&&v.status==="available");
export function videoEmbedUrl(video:typeof placeVideos[number]){
  const params=new URLSearchParams({rel:"0"});
  if(video.startSeconds)params.set("start",String(video.startSeconds));
  return `https://www.youtube-nocookie.com/embed/${video.videoId}?${params}`;
}

import {z} from "zod/v3";
const id=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const https=z.string().url().refine(v=>new URL(v).protocol==="https:","Use an HTTPS source URL");
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10),"Invalid review date");
export const placePhotoSchema=z.object({
  placeId:id,src:z.string().startsWith("/images/"),srcSmall:z.string().startsWith("/images/").optional(),
  sourcePage:https,originalUrl:https,creator:z.string().min(1),license:z.string().min(1),licenseUrl:https,
  attribution:z.string().min(1),alt:z.string().min(8),width:z.number().int().positive(),height:z.number().int().positive(),
  checkedOn:date,objectPosition:z.string().optional(),
});
export const editorialSourceSchema=z.object({name:z.string().min(1),url:https,checkedOn:date,supports:z.string().min(1)});
export const placeContentSchema=z.object({
  placeId:id,summary:z.string().min(20).max(600),overview:z.array(z.string().min(20).max(1500)).min(1).max(4),
  highlights:z.array(z.object({text:z.string().min(1),sourceUrls:z.array(https).min(1)})).max(4),
  tips:z.array(z.object({text:z.string().min(1),sourceUrls:z.array(https).min(1)})).max(5),
  sources:z.array(editorialSourceSchema).min(1),photo:placePhotoSchema.optional(),
}).superRefine((p,ctx)=>{
  if(p.photo&&p.photo.placeId!==p.placeId)ctx.addIssue({code:"custom",message:"Photo must belong to this exact place"});
  for(const note of [...p.highlights,...p.tips])for(const url of note.sourceUrls)if(!p.sources.some(s=>s.url===url))ctx.addIssue({code:"custom",message:"Every note needs a recorded supporting source"});
});
export const placeVideoSchema=z.object({
  placeId:id,platform:z.literal("YouTube"),videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/),url:https,
  title:z.string().min(1),creator:z.string().min(1),creatorUrl:https.optional(),publishedOn:date.nullable(),checkedOn:date,
  relevance:z.string().min(10),review:z.enum(["metadata-and-description","visual-excerpt"]),
  limitation:z.string().min(1),startSeconds:z.number().int().nonnegative().optional(),
  status:z.enum(["available","unavailable"]),
}).superRefine((v,ctx)=>{const u=new URL(v.url);if(!["www.youtube.com","youtube.com"].includes(u.hostname)||u.pathname!=="/watch"||u.searchParams.get("v")!==v.videoId)ctx.addIssue({code:"custom",message:"Video ID must match its official YouTube source"});});
export type PlaceContent=z.infer<typeof placeContentSchema>;
export type PlacePhoto=z.infer<typeof placePhotoSchema>;
export type PlaceVideo=z.infer<typeof placeVideoSchema>;

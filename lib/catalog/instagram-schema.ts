import {z} from 'zod/v3';

/** Accept post permalinks, never profiles, stories, arbitrary HTML or scripts. */
export function canonicalInstagramUrl(value:string):string|null{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname)||u.username||u.password||u.port)return null;
  const match=/^\/(p|reel)\/([A-Za-z0-9_-]{5,64})\/?$/.exec(u.pathname);
  return match?`https://www.instagram.com/${match[1]}/${match[2]}/`:null;
 }catch{return null;}
}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10),'Use an actual review date');
const https=z.string().url().refine(v=>new URL(v).protocol==='https:');
export const instagramRecordSchema=z.object({
 placeId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 url:z.string().refine(v=>canonicalInstagramUrl(v)!==null,'Use an Instagram post or reel permalink').transform(v=>canonicalInstagramUrl(v)!),
 account:z.string().regex(/^[A-Za-z0-9._]{1,30}$/),accountName:z.string().min(1).max(100),
 relevance:z.string().min(15).max(500),checkedOn:date,
 review:z.enum(['public-post','publisher-reference']),
 evidenceUrls:z.array(https).min(1).max(5),limitation:z.string().min(15).max(800),
 presentation:z.enum(['manual-embed','link-only']),
 embedCheck:z.object({status:z.enum(['confirmed','unconfirmed','unavailable']),checkedOn:date.nullable(),note:z.string().min(10)}).strict(),
}).strict().superRefine((p,ctx)=>{
 if(p.embedCheck.status==='confirmed'&&!p.embedCheck.checkedOn)ctx.addIssue({code:'custom',message:'A confirmed embed needs its actual check date'});
 if(p.presentation==='manual-embed'&&p.embedCheck.status==='unavailable')ctx.addIssue({code:'custom',message:'An unavailable embed must remain link-only'});
 if(p.presentation==='manual-embed'&&p.review!=='public-post')ctx.addIssue({code:'custom',message:'Manual embed needs a public-post eligibility review, not only a publisher reference'});
});
export type InstagramRecord=z.infer<typeof instagramRecordSchema>;

/** Atomic publishing and runtime loading share the same limits. */
export function validateInstagramRecords(input:unknown,knownIds?:ReadonlySet<string>):InstagramRecord[]{
 const records=z.array(instagramRecordSchema).parse(input),seen=new Set<string>(),counts=new Map<string,number>();
 for(const r of records){
  if(knownIds&&!knownIds.has(r.placeId))throw new Error(`Unknown Instagram place ID: ${r.placeId}`);
  const key=`${r.placeId}:${r.url}`;
  if(seen.has(key))throw new Error(`Duplicate Instagram post: ${key}`);
  const count=(counts.get(r.placeId)||0)+1;
  seen.add(key);counts.set(r.placeId,count);
  if(count>3)throw new Error(`At most three Instagram posts per place: ${r.placeId}`);
 }
 return records;
}

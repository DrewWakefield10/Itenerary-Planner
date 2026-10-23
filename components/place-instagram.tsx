'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {instagramForPlace,instagramCoverForPlace} from '@/lib/catalog/instagram';
import type {InstagramRecord} from '@/lib/catalog/instagram-schema';
import type {DiscoveryPlace} from '@/lib/discovery';
import {loadInstagramRuntime,processInstagramEmbeds} from '@/lib/instagram-embed';
import {PlacePhoto} from './place-media';
const subscribeToClient=()=>()=>undefined,clientReady=()=>true,serverReady=()=>false;

function InstagramSlot({record,requested,attempt}:{record:InstagramRecord;requested:boolean;attempt:number}){
 const slot=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null),[fits,setFits]=useState(false),[waiting,setWaiting]=useState(false);
 useEffect(()=>{
  const observer=new ResizeObserver(entries=>setFits(entries[0].contentRect.width>=326));
  if(slot.current)observer.observe(slot.current);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!requested||!fits)return;
  const container=host.current;if(!container)return;
  // Instagram replaces markup itself. Keep its DOM outside React's child
  // reconciliation so resizing or navigating can clean it up reliably.
  const quote=document.createElement('blockquote'),link=document.createElement('a');
  quote.className='instagram-media';quote.dataset.instgrmPermalink=record.url;quote.dataset.instgrmVersion='14';
  link.href=record.url;link.textContent='View this post on Instagram';link.target='_blank';link.rel='noreferrer';
  quote.appendChild(link);container.replaceChildren(quote);
  let active=true;
  const timer=setTimeout(()=>{if(active)setWaiting(true);},15000);
  loadInstagramRuntime().then(()=>{if(active)processInstagramEmbeds();}).catch(()=>{});
  return()=>{active=false;clearTimeout(timer);container.replaceChildren();};
 },[requested,fits,attempt,record.url]);
 return <div ref={slot} className={`place-instagram-slot${requested&&fits?' is-requested':''}`} aria-label={`Instagram post by ${record.accountName}`}>
  <div ref={host}/>
  {requested&&!fits&&<p className="fine-print">This space is too narrow for the official embed. Use the original post link.</p>}
  {requested&&fits&&waiting&&<p className="fine-print">If the post is blank or unavailable, use the original post link.</p>}
 </div>;
}

export function PlaceInstagramCover({place}:{place:DiscoveryPlace}){
 const record=instagramCoverForPlace(place.id,!!place.image);
 return record?<InstagramResources records={[record]} placement="cover"/>:<PlacePhoto place={place} prominent/>;
}

export function PlaceInstagram({placeId,excludeCover=false}:{placeId:string;excludeCover?:boolean}){
 const cover=excludeCover?instagramCoverForPlace(placeId,false):undefined;
 const records=instagramForPlace(placeId).filter(r=>r.url!==cover?.url);
 return records.length?<InstagramResources records={records} placement="section"/>:null;
}

function InstagramResources({records,placement}:{records:InstagramRecord[];placement:'cover'|'section'}){
 const root=useRef<HTMLElement>(null),isCover=placement==='cover',titleId=`place-instagram-${placement}-title`,sourceLabel=isCover?'View original on Instagram':'View on Instagram';
 const interactive=useSyncExternalStore(subscribeToClient,clientReady,serverReady);
 const [requested,setRequested]=useState(false),[attempt,setAttempt]=useState(0),[state,setState]=useState<'idle'|'loading'|'requested'|'failed'|'narrow'>('idle');
 const hasEmbed=records.some(r=>r.presentation==='manual-embed');
 if(!records.length)return null;
 const load=()=>{
  if(!Array.from(root.current?.querySelectorAll('.place-instagram-slot')||[]).some(el=>el.clientWidth>=326)){setState('narrow');return;}
  setState('loading');setRequested(true);setAttempt(n=>n+1);
  loadInstagramRuntime().then(()=>setState('requested')).catch(()=>setState('failed'));
 };
 return <section ref={root} className={`discovery-section place-instagram${isCover?' place-instagram-cover':''}`} aria-labelledby={titleId}>
  <h2 id={titleId}>{isCover?'Instagram preview':<>From <em>Instagram.</em></>}</h2>
  <p>{isCover?'No approved cover photograph yet. Preview an original post from this place.':'Place-specific posts from their original accounts. Posts record a moment in time; current conditions may differ. These resources do not replace licensed cover photographs.'}</p>
  {hasEmbed&&<div className="place-instagram-consent">
   <p className="fine-print">Loading posts connects to Instagram, which may use cookies and receive your IP address. You can use the source links instead.</p>
   {state!=='requested'&&<button className="button secondary" onClick={load} disabled={!interactive||state==='loading'}>{state==='loading'?(isCover?'Loading Instagram preview…':'Loading Instagram posts…'):state==='failed'?(isCover?'Try Instagram preview again':'Try Instagram again'):(isCover?'Load Instagram preview':'Load Instagram posts')}</button>}
   <p role="status" className="fine-print">{state==='failed'?'Instagram could not be loaded. The original post links remain available.':state==='narrow'?`Use ${sourceLabel} to see the original post at this screen size.`:state==='requested'?`Instagram content was requested. If a post does not appear, use ${sourceLabel}.`:state==='loading'?'Contacting Instagram…':''}</p>
  </div>}
  <div className="place-instagram-grid">{records.map(r=><article className="place-instagram-resource" key={r.url}>
   {isCover?<p className="fine-print">From <a href={`https://www.instagram.com/${r.account}/`} target="_blank" rel="noreferrer">{r.accountName} (@{r.account})</a></p>:<><h3><a href={`https://www.instagram.com/${r.account}/`} target="_blank" rel="noreferrer">{r.accountName} (@{r.account})</a></h3><p>{r.relevance}</p></>}
   {r.presentation==='manual-embed'&&<InstagramSlot record={r} requested={requested&&state!=='failed'} attempt={attempt}/>}
   <a className="text-link" href={r.url} target="_blank" rel="noreferrer" aria-label={`${sourceLabel} — ${r.accountName}`}>{sourceLabel} ↗</a>
   <p className="fine-print">Source checked {r.checkedOn}.{r.presentation==='link-only'?' External link; embedding has not been confirmed available.':''}</p>
   <details className="place-video-review"><summary>About this post check</summary>{isCover&&<p>{r.relevance}</p>}<p>{r.limitation}</p>{r.evidenceUrls.filter(url=>url!==r.url).map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">Supporting source ↗</a></p>)}</details>
  </article>)}</div>
 </section>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from 'next/link';
import { useRouter,useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Sparkles,
} from "lucide-react";
import {
  selectableDestinations,
  destinationImage,
  personalities,
  destination,
} from "@/lib/destinations";
import {
  defaultRequest,
  requestSchema,
  type TripRequest,
} from "@/lib/trip";
import { totalBudget, recommendDestinations, travelers } from "@/lib/engine";
import { readLocal, writeLocal } from "@/lib/storage";
import { saveTrip } from "@/lib/trip-storage";
import {placeTypes,placeTypeLabels} from "@/lib/catalog/place-types";
import {plannerEntry,readPlannerDraft,applyPlannerPrefill,clearPlannerPrefillQuery,type PlannerPrefill} from '@/lib/planner-entry';
import ConfirmDialog from './confirm-dialog';
import { discoveryPlace } from "@/lib/discovery";
import { emptyManualDraft, finishManualTrip, isTimed, layoutManualDays, manualDayWarnings, manualDraftSchema, type ManualDraft } from "@/lib/manual-planning";
import { ManualBudgetFields, ManualBudgetSummary, ManualItinerary, type GapTarget } from "./manual-itinerary";
import ManualSuggestions from "./manual-suggestions";
const steps = [
  "The basics",
  "Your itinerary",
  "Your travel style",
  "Your budget",
  "Your pace",
  "The little details",
  "Ready to wander",
];
export default function Planner() {
  const router = useRouter();
  const query=useSearchParams().toString();
  const [r, setR] = useState<TripRequest>(defaultRequest);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [draftSaved,setDraftSaved] = useState(false);
  const [draft, setDraft] = useState<ManualDraft>(emptyManualDraft);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [direct, setDirect] = useState<GapTarget | null>(null);
  const initialized = useRef(false);
  const [error, setError] = useState("");

  const [pendingPrefill,setPendingPrefill]=useState<PlannerPrefill|null>(null);
  const [prefillMode,setPrefillMode]=useState<'replace'|'add'>('replace');
  const [useSuggestedDays,setUseSuggestedDays]=useState(false);
  const [invalidDraft,setInvalidDraft]=useState(false);
  const hasLegacyBase = r.destinations.some(slug => destination(slug)?.legacyOnly);
  const baseGroups = [
    {name: "Palawan", choices: selectableDestinations.filter(d => d.province === "Palawan")},
    {name: "Other overnight bases", choices: selectableDestinations.filter(d => d.province !== "Palawan")},
  ];
  useEffect(() => {
    if(initialized.current && !["place","destinations","days"].some(key=>new URLSearchParams(query).has(key))) return;
    const rawDraft=readPlannerDraft();
    const entry=plannerEntry(rawDraft,query,readLocal('preferred-pace','Balanced'));
    const parsedDraft=manualDraftSchema.safeParse(readLocal("manual-planner",null));
    const place=discoveryPlace(new URLSearchParams(query).get("place") || "");
    if(!initialized.current && entry.draftValid) {
      initialized.current=true;
      const saved=parsedDraft.success?parsedDraft.data:emptyManualDraft;
      setDraft({...saved, days:layoutManualDays(entry.request,saved.days)});
      setStep(place?.directory?1:saved.step);
    }
    if(place?.directory){setIncoming(place.id);setStep(1);}
    setR(rawDraft===null?{...entry.request,interests:[]}:entry.request);
    setPendingPrefill(entry.draftValid?entry.proposal:null);
    setPrefillMode('replace');setUseSuggestedDays(false);setError('');
    setInvalidDraft(!entry.draftValid);
    setLoaded(entry.draftValid);
    if(rawDraft===null&&entry.draftValid&&(new URLSearchParams(query).has('destinations')||new URLSearchParams(query).has('days'))&&writeLocal('draft',entry.request))clearPlannerPrefillQuery(query);
  }, [query]);
  useEffect(() => {
    if (loaded && !pendingPrefill && !invalidDraft) {
      const choices = requestSchema.safeParse(r);
      const saved = writeLocal("manual-planner", {...draft,step});
      setDraftSaved(choices.success && writeLocal("draft", choices.data) && saved);
    }
  }, [r, draft, step, loaded, pendingPrefill, invalidDraft]);
  function closeIncoming() {
    setIncoming(null);
    const params=new URLSearchParams(window.location.search);
    params.delete("place");
    window.history.replaceState(null,"","/planner"+(params.size?"?"+params:""));
  }
  function consumePrefill(){
    clearPlannerPrefillQuery(query);
  }
  function keepDraft(){setPendingPrefill(null);setError('');consumePrefill();}
  function acceptPrefill(){
    if(!pendingPrefill)return;
    try{
      const next=applyPlannerPrefill(r,pendingPrefill,prefillMode,useSuggestedDays);
      if(!writeLocal('draft',next)){setError('Your draft could not be saved. Your previous choices have been kept.');return;}
      setR(next);setDraft(current=>({...current,days:layoutManualDays(next,current.days)}));setPendingPrefill(null);setError('');consumePrefill();
    }catch(e){setError(e instanceof Error?('issues' in e?(e as {issues:{message:string}[]}).issues.map(i=>i.message).join(' '):e.message):'These choices do not fit the current trip. Check the number of bases and days.');}
  }
  function change<K extends keyof TripRequest>(key: K, value: TripRequest[K]) {
    setR({ ...r, [key]: value });
    setError("");
  }
  function goTo(target: number) {
    if (target > 0 && (step === 0 || !draft.days.length)) {
      if (hasLegacyBase) {
        setError("Choose an explicit overnight base to replace the legacy Palawan selection for this new trip.");
        return;
      }
      const parsed = requestSchema.safeParse(r);
      if (!parsed.success) { setError(parsed.error.issues.map(issue=>issue.message).join(" ")); return; }
      setDraft({...draft,days:layoutManualDays(parsed.data,draft.days)});
    }
    setStep(target);
    setDirect(null);
    setError("");
    window.scrollTo({top:0});
    requestAnimationFrame(()=>document.getElementById("planner-chapter")?.focus({preventScroll:true}));
  }
  function finish() {
    try {
      const trip = finishManualTrip(r,draft);
      if (!saveTrip(trip)) throw new Error("This browser could not save the itinerary. Your planner draft is still open.");
      router.push(`/trips/${trip.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not finish this draft.");
    }
  }
  if(invalidDraft)return <section className="page section narrow"><h1 className="page-title">Your saved <em>planner draft.</em></h1><div className="paper-note" role="alert"><p>The saved draft could not be read or validated. It has not been overwritten. Saved itineraries are separate and remain in My Trips.</p><button className="button" onClick={()=>{const fresh=plannerEntry(null,query,readLocal('preferred-pace','Balanced')).request;if(writeLocal('draft',fresh)){setR(fresh);setStep(0);setDraft({...emptyManualDraft,days:layoutManualDays(fresh,[])});setInvalidDraft(false);setLoaded(true);consumePrefill();}else setError('Storage is unavailable. The existing draft has been kept.');}}>Start a new planner draft</button>{error&&<p>{error}</p>}<Link href="/my-trips" className="text-link">Open My Trips</Link></div></section>;
  return (
    <section className="page section planner-page">
      {pendingPrefill&&<ConfirmDialog title="Use these choices for your draft?" action="Apply to planner draft" cancelLabel="Keep my draft" onClose={keepDraft} onConfirm={acceptPrefill}>
        <p>Your existing planner draft has been kept. Budget, dates, pace, interests and other preferences will stay as entered.</p>
        <p><strong>Current:</strong> {r.destinations.map(s=>destination(s)?.name).join(', ')} / {r.days} days</p>
        <p><strong>From this link:</strong> {pendingPrefill.destinations?.map(s=>destination(s)?.name).join(', ')||'Current destinations'}{pendingPrefill.days?` / ${pendingPrefill.days} days suggested`:''}</p>
        {pendingPrefill.destinations&&<fieldset className="prefill-options"><legend>How should these destinations fit?</legend><label><input type="radio" name="prefill-mode" checked={prefillMode==='replace'} onChange={()=>setPrefillMode('replace')}/> Use the destinations from this link</label><label><input type="radio" name="prefill-mode" checked={prefillMode==='add'} onChange={()=>setPrefillMode('add')}/> Add to my existing destinations</label><small>The existing three-base and minimum-duration limits still apply.</small></fieldset>}
        {pendingPrefill.days&&<label className="prefill-days"><input type="checkbox" checked={useSuggestedDays} onChange={e=>setUseSuggestedDays(e.target.checked)}/> Use the suggested {pendingPrefill.days}-day duration</label>}
        {error&&<p className="notice error" role="alert">{error}</p>}
      </ConfirmDialog>}
      <span className="eyebrow">A BLANK PAGE. A WHOLE LOT OF POSSIBILITY.</span>
      <h1 className="page-title">
        Let’s write <em>your next story.</em>
      </h1>
      <p className="lede">
        A few little details. An adventure that feels like you.
      </p>
      <div className="planner-layout">
        <aside className="planner-sidebar">
          <ol>
            {steps.map((s, i) => (
              <li
                className={i === step ? "current" : i === 0 && step > 0 ? "complete" : ""}
                key={s}
              >
                <button disabled={!loaded || !!pendingPrefill} aria-current={i===step?"step":undefined} onClick={() => goTo(i)}>
                  <span>
                    {i === 0 && step > 0 ? (
                      <Check size={15} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <div className="sidebar-note">
            <Compass size={27} />
            <span className="handwritten">
              The best trips begin
              <br />
              with a little curiosity.
            </span>
            <p>
              Plan each day yourself. Ask for suggestions when you want help with open time.
            </p>
          </div>
        </aside>
        <div className="planner-paper">
          <div className="paper-top">
            <span id="planner-chapter" tabIndex={-1}>CHAPTER {step + 1} OF 7 · {steps[step]}</span>
            <span>
              {loaded ? draftSaved ? "Draft saved on this browser" : "Complete valid trip basics to save these settings" : "Opening your journal…"}
            </span>
          </div>
          {step === 0 && (
            <>
              <h2>
                Where are we <em>headed?</em>
              </h2>
              <p>
                Choose up to three overnight bases, in visit order. Nearby
                attractions are stops within each base; changing bases needs a connection day.
              </p>
              <div className="form-grid">
                <label>
                  Departure city
                  <input
                    value={r.departure}
                    maxLength={80}
                    onChange={(e) => change("departure", e.target.value)}
                  />
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    value={r.startDate}
                    onChange={(e) => change("startDate", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Number of days
                  <input
                    type="number"
                    min={2}
                    max={21}
                    value={r.days}
                    onChange={(e) => change("days", Number(e.target.value))}
                  />
                </label>
                <div className="form-grid compact">
                  <label>
                    Adults
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={r.adults}
                      onChange={(e) => change("adults", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Children
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={r.children}
                      onChange={(e) =>
                        change("children", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="label-row">
                <label>Your destinations, in visit order</label>
                <button
                  className="text-link plain-button"
                  onClick={() => {
                    const d = recommendDestinations(
                      r.interests,
                      totalBudget(r) / travelers(r),
                    )[0];
                    setR({ ...r, destinations: [d.slug], days: d.days });
                  }}
                >
                  <Sparkles size={15} /> Surprise me
                </button>
              </div>
              {hasLegacyBase && <p className="legacy-base-note" role="status">
                Your draft uses the older “Palawan” label. Saved trips remain readable.
                For this new trip, choose an explicit overnight base below; choosing a base replaces that legacy selection.
              </p>}
              {baseGroups.map(group => <section className="destination-group" key={group.name} aria-label={group.name}>
                <h3>{group.name}</h3>
                {group.name === "Palawan" && <p className="fine-print">One island region, three separate places to stay. Select each base you plan to sleep in.</p>}
                <div className="destination-choices">
                {group.choices.map((d) => (
                  <button
                    aria-label={d.name}
                    aria-description={r.destinations.includes(d.slug) ? `Visit order ${r.destinations.indexOf(d.slug) + 1}` : undefined}
                    aria-pressed={r.destinations.includes(d.slug)}
                    className={
                      r.destinations.includes(d.slug) ? "selected" : ""
                    }
                    key={d.slug}
                    onClick={() => {
                      const current = r.destinations.filter(slug => !destination(slug)?.legacyOnly);
                      const picks = current.includes(d.slug)
                        ? current.filter((x) => x !== d.slug)
                        : [...current, d.slug];
                      if (picks.length <= 3) change("destinations", picks);
                      else setError("Choose up to three overnight bases. Remove a selected base before adding another.");
                    }}
                  >
                    <img src={destinationImage(d.slug)} alt="" />
                    <span>{d.name}</span>
                    {r.destinations.includes(d.slug) && (
                      <b>{r.destinations.indexOf(d.slug) + 1}</b>
                    )}
                  </button>
                ))}
                </div>
              </section>)}
              <p className="fine-print">
                A connection day is reserved between bases. Add your real arrival, departure and transfer arrangements.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h2>
                What makes you <em>feel alive?</em>
              </h2>
              <p>
                Pick a few favorites. We’ll suggest places that match your interests.
              </p>
              <div className="choice-grid interests">
                {personalities.map((p, i) => (
                  <button
                    className={r.interests.includes(p) ? "selected" : ""}
                    aria-pressed={r.interests.includes(p)}
                    key={p}
                    onClick={() =>
                      change(
                        "interests",
                        r.interests.includes(p)
                          ? r.interests.filter((x) => x !== p)
                          : [...r.interests, p],
                      )
                    }
                  >
                    <span className="choice-symbol">
                      {["☀", "△", "♨", "⌂", "↗", "❋", "◇", "≈", "✧"][i]}
                    </span>
                    {p}
                    {r.interests.includes(p) && <Check size={15} />}
                  </button>
                ))}
              </div>
              <details className="paper-note" open={r.activityCategories.length>0}>
                <summary>Choose specific place types (optional)</summary>
                <p className="fine-print">Select any types you want to visit. These take priority over broad interests. Only matching places are suggested; a beach bar does not count as a beach. Limited matches leave open time.</p>
                <fieldset>
                  <legend>Place types</legend>
                  <div className="place-type-options">
                    {placeTypes.map(type=><label className="check-label" key={type}>
                      <input type="checkbox" checked={r.activityCategories.includes(type)} onChange={e=>change("activityCategories",e.target.checked?[...r.activityCategories,type]:r.activityCategories.filter(t=>t!==type))}/>
                      {placeTypeLabels[type]}
                    </label>)}
                  </div>
                </fieldset>
              </details>
            </>
          )}
          {step === 1 && <>
            <h2>Your <em>itinerary.</em></h2>
            <p>Fill in the days you want to plan. Leave the rest open.</p>
            <ManualItinerary request={r} draft={draft} change={setDraft} placeId={pendingPrefill?null:incoming} closeIncoming={closeIncoming} suggest={setDirect}/>
            {direct && <ConfirmDialog title="Suggestions for this gap" cancelLabel="Close" action="Done" onClose={()=>setDirect(null)} onConfirm={()=>setDirect(null)}>
              <ManualSuggestions request={r} draft={draft} change={setDraft} direct={direct} editItinerary={()=>setDirect(null)}/>
            </ConfirmDialog>}
          </>}
          {step === 3 && <>
            <h2>Your <em>budget.</em></h2>
            <ManualBudgetFields draft={draft} change={setDraft}/>
          </>}
          {step === 4 && (
            <>
              <h2>
                Leave room to <em>breathe.</em>
              </h2>
              <p>How full should your days feel?</p>
              <div className="pace-choices">
                {[
                  [
                    "Chill",
                    "Slow mornings, one main stop, and a generous rest.",
                  ],
                  [
                    "Balanced",
                    "A couple of nearby discoveries, with time in between.",
                  ],
                  ["Packed", "Up to three nearby stops when the day allows."],
                ].map(([p, desc]) => (
                  <button
                    key={p}
                    className={r.pace === p ? "selected" : ""}
                    onClick={() => change("pace", p as TripRequest["pace"])}
                  >
                    <span className="choice-symbol">
                      {p === "Chill" ? "≈" : p === "Balanced" ? "☀" : "↗"}
                    </span>
                    <span>
                      <h3>{p}</h3>
                      <p>{desc}</p>
                    </span>
                    {r.pace === p && <Check size={20} />}
                  </button>
                ))}
              </div>
              <label className="check-label"><input type="checkbox" checked={r.includeExcursions} onChange={e=>change("includeExcursions",e.target.checked)} /> Include separate full-day excursions or tour proposals</label>
              <p className="fine-print">Opt in to reserve entire days for outlying visits. Routes, guides, permits and availability need confirmation; no booking is made.</p>
            </>
          )}
          {step === 5 && (
            <>
              <h2>
                It’s the little things
                <br />
                <em>that make it yours.</em>
              </h2>
              <p>
                Optional details. Saved with your trip; local suitability and
                bookings need confirmation.
              </p>
              <div className="form-grid">
                {(
                  [
                    ["diet", "Dietary requirements"],
                    ["accessibility", "Accessibility needs"],
                    ["stay", "Accommodation preference"],
                    ["avoid", "Activities to avoid"],
                    ["must", "Must-visit attractions"],
                    ["reservations", "Confirmed reservations"],
                    ["requirements", "Other travel requirements"],
                  ] as [keyof TripRequest, string][]
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <textarea className="resize-none" style={{resize:"none",minHeight:100}}
                      maxLength={
                        key === "reservations"
                          ? 1000
                          : key === "stay"
                            ? 200
                            : 500
                      }
                      value={String(r[key])}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p className="fine-print">
                Add exact booked times as fixed reservations in Your itinerary. Free-text reservations are saved as notes.
              </p>
            </>
          )}
          {step === 6 && <>
            <h2>Ready to <em>wander.</em></h2>
            <p>{r.days} days from {r.startDate} · {travelers(r)} travelers</p>
            {draft.days.slice(r.days).some(d=>d.activities.length || d.windows?.length) && <p className="notice">Review the days outside your current duration in Your itinerary before finishing.</p>}
            <ol className="manual-review">
              {draft.days.slice(0,r.days).map(d=><li key={d.id}>
                <strong>{d.title} · {d.date}</strong>
                <p>{d.activities.length?d.activities.map(a=>`${isTimed(a)?a.start+" ":""}${a.name}${a.locked?" (fixed)":""}`).join(" · "):"Open day"}</p>
                {manualDayWarnings(d,r).map(warning=><p className="fine-print" key={warning}>{warning}</p>)}
              </li>)}
            </ol>
            <button className="text-link" onClick={()=>goTo(1)}>Edit your itinerary</button>
            <ManualBudgetSummary draft={draft}/>
            <details className="manual-help-disclosure"><summary>Suggest additions</summary>
              <ManualSuggestions request={r} draft={draft} change={setDraft} editItinerary={()=>goTo(1)}/>
            </details>
          </>}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="planner-actions">
            <button className="text-link plain-button" disabled={step===0} onClick={()=>goTo(step-1)}><ArrowLeft size={17}/> Back</button>
            {step===1 && <button className="button secondary" onClick={()=>goTo(6)}>Go to Ready to wander</button>}
            {step<6
              ? <button className="button" disabled={!loaded || !!pendingPrefill} onClick={()=>goTo(step+1)}>Next chapter <ArrowRight size={17}/></button>
              : <button className="button" disabled={!loaded || !!pendingPrefill} onClick={finish}>Finish my itinerary <ArrowRight size={17}/></button>}
          </div>
        </div>
      </div>
    </section>
  );
}

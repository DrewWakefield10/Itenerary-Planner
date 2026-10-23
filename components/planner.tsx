"use client";
import { useEffect, useState } from "react";
import Link from 'next/link';
import { useRouter,useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Sparkles,
  MapPin,
  Wallet,
  Users,
  Calendar,
  LoaderCircle,
} from "lucide-react";
import {
  selectableDestinations,
  destinationImage,
  personalities,
  peso,
  destination,
} from "@/lib/destinations";
import {
  defaultRequest,
  requestSchema,
  tripSchema,
  type TripRequest,
} from "@/lib/trip";
import { totalBudget, recommendDestinations, travelers } from "@/lib/engine";
import { readLocal, writeLocal } from "@/lib/storage";
import { saveTrip } from "@/lib/trip-storage";
import {placeTypes,placeTypeLabels} from "@/lib/catalog/place-types";
import {plannerEntry,readPlannerDraft,applyPlannerPrefill,clearPlannerPrefillQuery,type PlannerPrefill} from '@/lib/planner-entry';
import ConfirmDialog from './confirm-dialog';
const steps = [
  "The basics",
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
  const [mode, setMode] = useState("demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    const rawDraft=readPlannerDraft();
    const entry=plannerEntry(rawDraft,query,readLocal('preferred-pace','Balanced'));
    setR(entry.request);
    setPendingPrefill(entry.draftValid?entry.proposal:null);
    setPrefillMode('replace');setUseSuggestedDays(false);setError('');
    setInvalidDraft(!entry.draftValid);
    setLoaded(entry.draftValid);
    if(rawDraft===null&&entry.draftValid&&(new URLSearchParams(query).has('destinations')||new URLSearchParams(query).has('days'))&&writeLocal('draft',entry.request))clearPlannerPrefillQuery(query);
  }, [query]);
  useEffect(()=>{
    fetch("/api/generate")
      .then((r) => r.json() as Promise<{ mode: string }>)
      .then((x) => setMode(x.mode))
      .catch(() => setMode("demo"));
  }, []);
  useEffect(() => {
    if (loaded&&!pendingPrefill&&!invalidDraft) setDraftSaved(writeLocal("draft", r));
  }, [r, loaded,pendingPrefill,invalidDraft]);
  function consumePrefill(){
    clearPlannerPrefillQuery(query);
  }
  function keepDraft(){setPendingPrefill(null);setError('');consumePrefill();}
  function acceptPrefill(){
    if(!pendingPrefill)return;
    try{
      const next=applyPlannerPrefill(r,pendingPrefill,prefillMode,useSuggestedDays);
      if(!writeLocal('draft',next)){setError('Your draft could not be saved. Your previous choices have been kept.');return;}
      setR(next);setPendingPrefill(null);setError('');consumePrefill();
    }catch(e){setError(e instanceof Error?('issues' in e?(e as {issues:{message:string}[]}).issues.map(i=>i.message).join(' '):e.message):'These choices do not fit the current trip. Check the number of bases and days.');}
  }
  function change<K extends keyof TripRequest>(key: K, value: TripRequest[K]) {
    setR({ ...r, [key]: value });
    setError("");
  }
  function next() {
    if (step === 0 && hasLegacyBase) {
      setError("Choose an explicit overnight base to replace the legacy Palawan selection for this new trip.");
      return;
    }
    const parsed = requestSchema.safeParse(r);
    if (step === 0 && !parsed.success) {
      const e = parsed.error.issues.filter((i) =>
        [
          "departure",
          "destinations",
          "startDate",
          "days",
          "adults",
          "children",
        ].includes(String(i.path[0])),
      );
      if (e.length) {
        setError(e.map((x) => x.message).join(" "));
        return;
      }
    }
    if (
      step === 2 &&
      (!Number.isInteger(r.budget) || r.budget < 500 || r.budget > 2000000)
    ) {
      setError("Choose a budget from ₱500 to ₱2,000,000.");
      return;
    }
    setStep(step + 1);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function generate(demo = false) {
    if (hasLegacyBase) {
      setStep(0);
      setError("Choose an explicit overnight base to replace the legacy Palawan selection for this new trip.");
      return;
    }
    const parsed = requestSchema.safeParse(r);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: r, demo }),
        signal: AbortSignal.timeout(35000),
      });
      const data = (await res.json()) as { error?: string; trip: unknown };
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      const trip = tripSchema.parse(data.trip);
      if (!saveTrip(trip))
        throw new Error(
          "This browser could not save the itinerary. Enable local storage and retry.",
        );
      router.push(`/trips/${trip.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Generation failed. Your draft is saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  if(invalidDraft)return <section className="page section narrow"><h1 className="page-title">Your saved <em>planner draft.</em></h1><div className="paper-note" role="alert"><p>The saved draft could not be read or validated. It has not been overwritten. Saved itineraries are separate and remain in My Trips.</p><button className="button" onClick={()=>{const fresh=plannerEntry(null,query,readLocal('preferred-pace','Balanced')).request;if(writeLocal('draft',fresh)){setR(fresh);setInvalidDraft(false);setLoaded(true);consumePrefill();}else setError('Storage is unavailable. The existing draft has been kept.');}}>Start a new planner draft</button>{error&&<p>{error}</p>}<Link href="/my-trips" className="text-link">Open My Trips</Link></div></section>;
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
                className={i === step ? "current" : i < step ? "complete" : ""}
                key={s}
              >
                <button disabled={i > step || busy} onClick={() => setStep(i)}>
                  <span>
                    {i < step ? (
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
              {mode === "demo"
                ? "Demo mode is ready. Your plan uses curated places and estimated allowances."
                : "AI can choose matching catalog places; the planner checks destinations, schedules and estimates."}
            </p>
          </div>
        </aside>
        <div className="planner-paper">
          <div className="paper-top">
            <span>CHAPTER {String(step + 1).padStart(2, "0")} OF 06</span>
            <span>
              {loaded ? draftSaved ? "Draft saved on this browser" : "Draft could not be saved" : "Opening your journal…"}
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
                Arrival and departure buffers are included. A full connection
                day is reserved between destinations; transport must be verified
                separately.
              </p>
            </>
          )}
          {step === 1 && (
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
          {step === 2 && (
            <>
              <h2>
                Big memories.
                <br />
                <em>Your kind of budget.</em>
              </h2>
              <p>
                Every amount is in Philippine pesos. We’ll keep the arithmetic
                honest.
              </p>
              <div className="chips">
                {(
                  [
                    "Backpacker",
                    "Budget",
                    "Comfortable",
                    "Premium",
                    "Custom",
                  ] as const
                ).map((t) => (
                  <button
                    className={r.tier === t ? "selected" : ""}
                    key={t}
                    onClick={() => {
                      const amounts = {
                        Backpacker: 1300,
                        Budget: 1800,
                        Comfortable: 3000,
                        Premium: 6500,
                        Custom: 0,
                      };
                      setR({
                        ...r,
                        tier: t,
                        budget:
                          t === "Custom"
                            ? r.budget
                            : amounts[t] *
                              r.days *
                              (r.budgetMode === "total" ? travelers(r) : 1),
                      });
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="form-grid">
                <label>
                  Budget amount (₱)
                  <input
                    type="number"
                    min={500}
                    max={2000000}
                    step={1}
                    value={r.budget}
                    onChange={(e) => change("budget", Number(e.target.value))}
                  />
                </label>
                <label>
                  This amount is
                  <select
                    value={r.budgetMode}
                    onChange={(e) =>
                      change(
                        "budgetMode",
                        e.target.value as TripRequest["budgetMode"],
                      )
                    }
                  >
                    <option value="total">For the whole group</option>
                    <option value="person">Per person</option>
                  </select>
                </label>
                <label>
                  Emergency reserve (%)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={r.reserve}
                    onChange={(e) => change("reserve", Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={r.flights}
                  onChange={(e) => change("flights", e.target.checked)}
                />
                Include a provisional return-flight allowance (₱7,000/person,
                not a quote)
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={r.accommodation}
                  onChange={(e) => change("accommodation", e.target.checked)}
                />
                Include accommodation for {r.days - 1} nights
              </label>
              <div className="budget-ticket">
                <Wallet size={24} />
                <div>
                  <small>YOUR GROUP’S PLANNING LIMIT</small>
                  <strong>{peso(totalBudget(r))}</strong>
                </div>
                <span>
                  including{" "}
                  {peso(Math.round((totalBudget(r) * r.reserve) / 100))} reserve
                </span>
              </div>
            </>
          )}
          {step === 3 && (
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
          {step === 4 && (
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
                For exact booked times, add and lock the reservation in your
                generated itinerary. Free-text reservations are retained as
                notes, not automatically scheduled.
              </p>
            </>
          )}
          {step === 5 && (
            <>
              <h2>
                Your next chapter
                <br />
                <em>is almost here.</em>
              </h2>
              <div className="review-list">
                <div>
                  <MapPin />
                  <span>
                    YOUR PLACES
                    <strong>
                      {r.destinations
                        .map((s) => destination(s)?.name)
                        .join(" → ")}
                    </strong>
                  </span>
                </div>
                <div>
                  <Calendar />
                  <span>
                    YOUR TIME
                    <strong>
                      {r.days} days from {r.startDate}
                    </strong>
                  </span>
                </div>
                <div>
                  <Users />
                  <span>
                    YOUR PEOPLE
                    <strong>
                      {r.adults} adults · {r.children} children · {r.pace} pace
                    </strong>
                  </span>
                </div>
                <div>
                  <Wallet />
                  <span>
                    YOUR BUDGET
                    <strong>
                      {peso(totalBudget(r))} total · {r.reserve}% reserve
                    </strong>
                  </span>
                </div>
              </div>
              <div className="notice">
                {mode === "demo"
                  ? "Demo generation: matching catalog places, varied choices, and estimated schedules and costs. No live AI or bookings are connected."
                  : "AI selects from matching catalog places and personalizes journal text. The planner validates selections; schedules and costs remain estimates."}
              </div>
            </>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="planner-actions">
            <button
              className="text-link plain-button"
              disabled={step === 0 || busy}
              onClick={() => {
                setStep(step - 1);
                setError("");
              }}
            >
              <ArrowLeft size={17} />
              Back
            </button>
            {step < 5 ? (
              <button className="button" disabled={!loaded} onClick={next}>
                Next chapter <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() => generate()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}{" "}
                {busy
                  ? "Building your itinerary…"
                  : mode === "demo"
                    ? "Generate demo itinerary"
                    : "Generate my itinerary"}
              </button>
            )}
          </div>
          {busy && (
            <p role="status" className="fine-print">
              {mode === "demo"
                ? "Selecting nearby stops and checking your budget."
                : "Requesting journal personalization and validating the response."}
            </p>
          )}
          {error && step === 5 && (
            <button
              className="text-link plain-button"
              disabled={busy}
              onClick={() => generate(true)}
            >
              Try catalog demo mode instead
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

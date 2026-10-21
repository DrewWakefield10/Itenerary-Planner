"use client";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Clock,
  MapPin,
  LockKeyhole,
  LockKeyholeOpen,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Undo2,
  Check,
  Download,
  Printer,
  CloudRain,
  Wallet,
  ClipboardList,
  X,
  Utensils,
  Coffee,
} from "lucide-react";
import {
  tripSchema,
  expenseCategories,
  type Trip,
  type Activity,
} from "@/lib/trip";
import { readTrips, saveTrip } from "@/lib/trip-storage";
import {deleteTrip} from "@/lib/trip-storage";
import {useAccount,GoogleSignIn} from "./account-provider";
import {loadAccountTrip,saveAccountTrip,pendingAction,privateDraftKey,AccountClientError} from "@/lib/account-client";
import type {AccountTrip} from "@/lib/account-contract";
import ConfirmDialog from "./confirm-dialog";
import TextEditDialog from "./text-edit-dialog";
import {discoveryPlace} from "@/lib/discovery";
import {dateOffset} from "@/lib/engine";
import {
  peso,
  destination,
  officialAdvisories,
  officialTravelLinks,
} from "@/lib/destinations";
import {
  budgetSummary,
  dayCost,
  endTime,
  validateDay,
  regenerateDay,
  reflow,
  blankActivity,
  uid,
  alternativePlan,
  disruptions,
  modifyBudget,
} from "@/lib/engine";
import ActivityEditor from "./activity-editor";
import WeatherPanel from "./weather-panel";
import {
  previewRainReplacement,
  affectedRainActivities,
  rainScheduleDifference,
  type RainAlternative,
} from "@/lib/rain-planning";
import {
  SourceIndicator,
  SourceReviewNote,
  AdvisorySources,
} from "./source-indicator";
const TripMap = lazy(() => import("./trip-map"));
type Tab = "Itinerary" | "Map" | "Budget" | "Essentials";
function download(trip: Trip) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(trip, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `lakbay-${trip.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function TripView() {
  const path = usePathname();
  const account=useAccount();
  const [record,setRecord]=useState<AccountTrip|null>(null),[ownerLock,setOwnerLock]=useState<string|null>(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState("");
  const [editDates,setEditDates]=useState(false);
  const latestTrip=useRef<Trip|null>(null);
  const currentUser=useRef(account.user?.id);currentUser.current=account.user?.id;
  const [leaveTo,setLeaveTo]=useState(""),[rename,setRename]=useState(false),[titleDraft,setTitleDraft]=useState(""),[dateDraft,setDateDraft]=useState("");
  const ignoreLeave=useRef(false),attempt=useRef<{snapshot:string;id:string}|null>(null),autoSaving=useRef(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  latestTrip.current=trip;
  const [loaded, setLoaded] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [tab, setTab] = useState<Tab>("Itinerary");
  const [history, setHistory] = useState<Trip[]>([]);
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<Activity | null>(null);
  const [message, setMessage] = useState("");
  const [readonly, setReadonly] = useState(false);
  const [planB, setPlanB] = useState(false);
  const [scenario, setScenario] = useState<string>("Heavy rain");
  const [proposal, setProposal] = useState<Trip | null>(null);
  const [rainPreview, setRainPreview] = useState<RainAlternative | null>(null);
  const [rainPreviewOrigin,setRainPreviewOrigin]=useState<'forecast'|'manual'>('forecast');
  const [variant, setVariant] = useState(1);
  useEffect(() => {
    if(account.loading)return;
    let cancelled=false;
    setLoaded(false);setTrip(null);setRecord(null);setOwnerLock(null);setSaveError("");
    setDayIndex(0);
    setHistory([]);
    setRainPreview(null);
    setReadonly(false);
    async function open(){try {
      if (path.split("/")[2] === "shared") {
        setTrip(null);setReadonly(true);setMessage("Public snapshot links are disabled. Restore a JSON backup into your own drafts instead.");
      } else {
        const id=path.split("/")[2];
        if(account.user){
          try{
            const saved=await loadAccountTrip(id);if(cancelled)return;
            setRecord(saved);setOwnerLock(saved.ownerId);
            let snapshot=saved.trip;
            try{const raw=sessionStorage.getItem(privateDraftKey(saved.ownerId,id));if(raw){const draft=JSON.parse(raw);const parsed=tripSchema.safeParse(draft.trip);if(parsed.success){snapshot=parsed.data;if(draft.revision!==saved.revision){setRecord({...saved,revision:draft.revision});setSaveError("This trip changed on another device. Your recovery draft is preserved. Reload the account version or save a copy.");}}}}catch{}
            setTrip(snapshot);
          }catch(e){
            if(cancelled)return;
            const draft=readTrips().find(t=>t.id===id);
            if(e instanceof AccountClientError&&e.status===404)setTrip(draft||null);
            else if(draft){setTrip(draft);setSaveError("Your account version could not be checked. This is the browser draft; retry saving when your connection returns.");}
            else setMessage(e instanceof Error?e.message:"Could not open this account trip. Retry.");
          }
        }else{
          const id=path.split("/")[2],previous=sessionStorage.getItem("lakbay:last-account");
          if(previous&&sessionStorage.getItem(privateDraftKey(previous,id)))setOwnerLock(previous);
          else setTrip(readTrips().find(t=>t.id===id)||null);
        }
      }
    } catch {if(!cancelled)setMessage("This trip is invalid or incomplete.");}
    setTab(
      path.endsWith("/budget")
        ? "Budget"
        : path.endsWith("/essentials")
          ? "Essentials"
          : "Itinerary",
    );
    if(!cancelled)setLoaded(true);
    }void open();return()=>{cancelled=true;};
  }, [path,account.loading,account.user?.id]);
  const dirty=!!record&&!!trip&&JSON.stringify(trip)!==JSON.stringify(record.trip);
  useEffect(()=>{
    if(!dirty)return;
    const unload=(e:BeforeUnloadEvent)=>{if(!ignoreLeave.current){e.preventDefault();e.returnValue="";}};
    const click=(e:MouseEvent)=>{if(ignoreLeave.current||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey)return;const link=(e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement|null;if(link&&link.target!=="_blank"&&link.href!==location.href&&!link.getAttribute("href")?.startsWith("#")){e.preventDefault();e.stopPropagation();setLeaveTo(link.href);}};
    window.addEventListener("beforeunload",unload);document.addEventListener("click",click,true);
    return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",click,true);};
  },[dirty]);
  async function saveToAccount(snapshot=trip){
    if(!snapshot||!account.user||saving)return;
    if(ownerLock&&ownerLock!==account.user.id){setSaveError("Sign in with the account that owns this trip.");return;}
    setSaving(true);setSaveError("");
    const serialized=JSON.stringify(snapshot);
    if(attempt.current?.snapshot!==serialized)attempt.current={snapshot:serialized,id:uid()};
    try{
      const result=await saveAccountTrip(snapshot,record?.revision||0,attempt.current!.id);
      if(currentUser.current!==result.ownerId)return;
      setRecord(result);setOwnerLock(result.ownerId);
      const newer=latestTrip.current&&JSON.stringify(latestTrip.current)!==serialized?latestTrip.current:null;
      if(!newer)setTrip(result.trip);deleteTrip(snapshot.id);
      if(newer)sessionStorage.setItem(privateDraftKey(result.ownerId,snapshot.id),JSON.stringify({trip:newer,revision:result.revision}));else sessionStorage.removeItem(privateDraftKey(result.ownerId,snapshot.id));pendingAction(null);setMessage(newer?"Earlier changes saved. Your latest edits still need Save Changes.":"Saved to your account. Available on your other devices.");
    }catch(e){setSaveError(e instanceof Error?e.message:"Could not save. Retry; your edits are preserved.");if(record)pendingAction({kind:"trip",id:snapshot.id,ownerId:record.ownerId});}
    finally{setSaving(false);}
  }
  useEffect(()=>{
    const action=pendingAction();
    if(loaded&&trip&&account.user&&action?.kind==="trip"&&action.id===trip.id&&(!action.ownerId||action.ownerId===account.user.id)&&!autoSaving.current){autoSaving.current=true;void saveToAccount().finally(()=>{autoSaving.current=false;});}
  },[loaded,trip?.id,account.user?.id]);
  function commit(next: Trip) {
    if (!trip || readonly) return;
    const parsed = tripSchema.safeParse(next);
    if (!parsed.success) {
      setMessage(
        "That change is invalid. Check amounts, times, and text lengths.",
      );
      return;
    }
    if (!record&&!saveTrip(parsed.data)) {
      setMessage(
        "Could not save this change. The previous version is preserved.",
      );
      return;
    }
    setHistory([...history.slice(-19), trip]);
    if(record){try{sessionStorage.setItem(privateDraftKey(record.ownerId,trip.id),JSON.stringify({trip:parsed.data,revision:record.revision}));}catch{setSaveError("Recovery storage is unavailable. Keep this tab open and export a backup before signing in again.");}}
    setTrip(parsed.data);
    setMessage(record?"Unsaved changes. Select Save Changes to update your account.":"Browser draft updated. This trip is not yet stored in your account.");
    setProposal(null);
    setRainPreview(null);
  }
  function updateActivities(activities: Activity[]) {
    if (!trip) return;
    const next = structuredClone(trip);
    next.days[dayIndex].activities = activities;
    commit(next);
  }
  function move(index: number, delta: number) {
    if (!trip) return;
    const acts = [...trip.days[dayIndex].activities];
    if (acts[index].locked || acts[index + delta]?.locked) return;
    [acts[index], acts[index + delta]] = [acts[index + delta], acts[index]];
    updateActivities(reflow(acts));
  }
  function select(id: string) {
    setSelected(id);
    if (tab === "Map") setTab("Itinerary");
    setTimeout(
      () =>
        document
          .getElementById(`activity-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );
  }
  function previewRain(suggestion: RainAlternative,origin:'forecast'|'manual'='forecast') {
    if (!trip || readonly) return;
    try {
      setProposal(previewRainReplacement(trip, dayIndex, suggestion));
      setRainPreview(suggestion);
      setRainPreviewOrigin(origin);
      setScenario("Heavy rain");
      setPlanB(true);
      setTimeout(
        () =>
          document
            .getElementById("plan-b-preview")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Preview could not be prepared.",
      );
    }
  }
  function confirmProposal() {
    if (!trip || !proposal || readonly) return;
    try {
      commit(
        rainPreview
          ? previewRainReplacement(trip, dayIndex, rainPreview)
          : proposal,
      );
      setPlanB(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This preview is no longer valid.",
      );
    }
  }
  if (!loaded)
    return <div className="page empty">Opening your travel journal…</div>;
  if(ownerLock&&(!account.user||ownerLock!==account.user.id))return <section className="page section"><h1 className="page-title">Return to <em>your trip.</em></h1><p>Your session ended. Sign in with the same Google account to reopen this private trip and recover pending edits.</p><GoogleSignIn returnTo={path} before={()=>pendingAction({kind:"trip",id:path.split("/")[2],ownerId:ownerLock})}/><Link href="/my-trips" className="text-link">My Trips</Link></section>;
  if (!trip)
    return (
      <div className="page empty">
        <BookOpen size={40} />
        <h2>This trip is not available here.</h2>
        <p>
          {message || "Open a saved journal here, or start a new adventure."}
        </p>
        <GoogleSignIn returnTo={path}/>
        <button className="button secondary" onClick={()=>location.reload()}>Retry opening trip</button>
        <Link href="/planner" className="button">
          Start a new adventure
        </Link>
      </div>
    );
  const b = budgetSummary(trip),
    day = trip.days[dayIndex],
    warnings = validateDay(day);
  const changed = proposal
    ? proposal.days[dayIndex].activities.filter(
        (a, i) => JSON.stringify(a) !== JSON.stringify(day.activities[i]),
      )
    : [];
  return (
    <section className="page section trip-page">
      <div className="trip-topline">
        <Link className="breadcrumb" href="/my-trips">
          <ArrowLeft size={15} />
          My travel journal
        </Link>
        <span className="saved-label">
          <Check size={13} />
          {readonly ? "Read-only shared snapshot" : record?dirty?"Unsaved changes":"Saved to your account":"Browser draft · not saved to an account"}
        </span>
      </div>
      <span className="eyebrow">
        {trip.mode === "demo"
          ? "DEMO-GENERATED ITINERARY"
          : "AI-PERSONALIZED JOURNAL · SEED ITINERARY"}
      </span>
      <div className="trip-title">
        <h1 className="page-title">{trip.title}</h1>
        {!readonly && (
          <button
            className="icon-button"
            aria-label="Rename trip"
            onClick={() => {
              setTitleDraft(trip.title);setRename(true);
            }}
          >
            <Pencil size={17} />
          </button>
        )}
      </div>
      <p className="lede">
        {trip.days.length} days · {trip.request.adults + trip.request.children}{" "}
        travelers · {trip.request.pace} pace · {trip.request.startDate}
      </p>
      <div className="trip-toolbar">
        {!readonly&&(account.user?<button className="button small trip-account-save" aria-busy={saving} disabled={saving||!!record&&!dirty} onClick={()=>saveToAccount()}>{saving?"Saving…":record?"Save Changes":"Save Trip"}</button>:<GoogleSignIn returnTo={path} before={()=>pendingAction({kind:"trip",id:trip.id,ownerId:ownerLock||undefined})}>Save Trip</GoogleSignIn>)}
        {!readonly&&<button className="button secondary small" onClick={()=>{setDateDraft(trip.request.startDate);setEditDates(true);setRename(false);setTitleDraft("");}}>Update travel dates</button>}
        <button
          className="button secondary small"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Print / Save PDF
        </button>
        <button
          className="button secondary small"
          onClick={() => download(trip)}
        >
          <Download size={16} />
          Export backup
        </button>
        {!readonly && (
          <>
            <button
              className="button secondary small"
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1)!;
                {
                  commit(previous);
                  setHistory(history.slice(0, -1));
                  setProposal(null);
                  setMessage("Last change undone.");
                }
              }}
            >
              <Undo2 size={16} />
              Undo
            </button>
          </>
        )}
      </div>
      {saveError&&<div className="notice error" role="alert">{saveError}<div className="trip-toolbar"><button className="button secondary small" disabled={saving} onClick={()=>saveToAccount()}>Retry save</button>{record&&<><button className="button secondary small" onClick={()=>{sessionStorage.removeItem(privateDraftKey(record.ownerId,trip.id));ignoreLeave.current=true;location.reload();}}>Reload account version</button><button className="button secondary small" disabled={saving} onClick={async()=>{const copy={...structuredClone(trip),id:uid(),title:`${trip.title.slice(0,145)} (copy)`,createdAt:new Date().toISOString()};try{await saveAccountTrip(copy,0,uid());ignoreLeave.current=true;location.assign(`/trips/${copy.id}`);}catch(e){setSaveError(e instanceof Error?e.message:"Could not save a copy.");}}}>Save a copy</button></>}</div></div>}
      {!!trip.days.flatMap(d=>d.activities).filter(a=>a.catalogStopId&&!discoveryPlace(a.catalogStopId)).length&&<p className="notice">Some saved locations are no longer in the current directory. Their saved descriptions and source details are preserved; confirm current availability.</p>}
      {rename&&<TextEditDialog initial={titleDraft} onClose={()=>setRename(false)} onSave={title=>{commit({...trip,title});setRename(false);}}/>}
      {editDates&&<div className="paper-note"><label>Trip start date<input type="date" value={dateDraft} onChange={e=>setDateDraft(e.target.value)}/></label><div className="trip-toolbar"><button className="button" onClick={()=>{try{const next=structuredClone(trip);next.request.startDate=dateDraft;next.days.forEach((d,i)=>d.date=dateOffset(dateDraft,i));if(!tripSchema.safeParse(next).success)throw new Error();commit(next);setEditDates(false);}catch{setMessage("Choose a valid travel date.");}}}>Update dates</button><button className="button secondary" onClick={()=>setEditDates(false)}>Cancel</button></div><p className="fine-print">Saved stops are preserved. Review recorded opening days and any dated reservations after changing dates.</p></div>}
      {leaveTo&&<ConfirmDialog title="Leave with unsaved changes?" action="Leave page" onClose={()=>setLeaveTo("")} onConfirm={()=>{ignoreLeave.current=true;location.assign(leaveTo);}}><p>Your edits are not saved to your account. A recovery draft stays in this tab until you sign out; export a backup if needed.</p></ConfirmDialog>}
      {message && (
        <div className="notice" role="status">
          {message}
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            <X size={15} />
          </button>
        </div>
      )}
      <div className="trip-summary">
        <div>
          <span>ESTIMATED TOTAL + RESERVE</span>
          <strong>{peso(b.total)}</strong>
        </div>
        <div>
          <span>PER PERSON</span>
          <strong>{peso(b.perPerson)}</strong>
        </div>
        <div className={b.remaining < 0 ? "over-budget" : ""}>
          <span>
            {b.remaining < 0 ? "OVER YOUR BUDGET" : "ROOM IN YOUR BUDGET"}
          </span>
          <strong>{peso(Math.abs(b.remaining))}</strong>
        </div>
        <div>
          <span>YOUR PLANNING LIMIT</span>
          <strong>{peso(b.budget)}</strong>
        </div>
      </div>
      {b.remaining < 0 && (
        <div className="notice error">
          This plan exceeds your budget by {peso(-b.remaining)}. Remove optional
          paid stops, shorten the trip, or increase the limit. Estimates have
          not been discounted to fit.
        </div>
      )}
      <div className="trip-tabs" role="tablist" aria-label="Trip views">
        {(["Itinerary", "Map", "Budget", "Essentials"] as Tab[]).map((t, i) => {
          const Icon = [BookOpen, MapPin, Wallet, ClipboardList][i];
          return (
            <button
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "selected" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              <Icon size={17} />
              {t}
            </button>
          );
        })}
      </div>
      {(tab === "Itinerary" || tab === "Map") && (
        <>
          <div className="day-tabs">
            {trip.days.map((d, i) => (
              <button
                className={i === dayIndex ? "selected" : ""}
                key={d.id}
                onClick={() => {
                  setDayIndex(i);
                  setSelected("");
                  setProposal(null);
                  setPlanB(false);
                  setRainPreview(null);
                }}
              >
                Day {i + 1}
                <small>{destination(d.destination)?.name}</small>
              </button>
            ))}
          </div>
          <div
            className={`itinerary-layout ${tab === "Map" ? "map-only" : ""}`}
          >
            <div className="itinerary-column">
              <div className="day-heading">
                <span className="eyebrow">
                  {day.date} · {trip.request.pace.toUpperCase()} PACE
                </span>
                <h2>{day.title}</h2>
                <p>{peso(dayCost(day))} estimated for the group</p>
              </div>
              <WeatherPanel
                key={day.id}
                slug={day.destination}
                date={day.date}
                trip={trip}
                dayIndex={dayIndex}
                onPreview={readonly ? undefined : previewRain}
              />
              {trip.destinationInfo
                .filter((d) => d.slug === day.destination)
                .map((d) => (
                  <details
                    className="activity-details destination-field-notes"
                    key={d.slug}
                  >
                    <summary>Destination field notes & sources</summary>
                    <p>
                      {d.locationDetails}{" "}
                      <SourceIndicator
                        source={d.sources.location}
                        label="Destination location context"
                      />
                    </p>
                    <p>
                      {d.transport}{" "}
                      <SourceIndicator
                        source={d.sources.transport}
                        label="Destination transport guidance"
                      />
                    </p>
                    <p>
                      {d.accessibility}{" "}
                      <SourceIndicator
                        source={d.sources.accessibility}
                        label="Destination accessibility"
                      />
                    </p>
                    <p>
                      Guide allowance: {peso(d.daily)} / person / day{" "}
                      <SourceIndicator
                        source={d.sources.price}
                        label="Guide daily allowance"
                      />
                    </p>
                    <p>
                      Destination map pin{" "}
                      <SourceIndicator
                        source={d.sources.coordinates}
                        label="Destination map coordinates"
                      />
                    </p>
                    <SourceReviewNote />
                  </details>
                ))}
              {warnings.length > 0 && (
                <details className="validation-notes" open>
                  <summary>
                    {warnings.length} planning{" "}
                    {warnings.length === 1 ? "note" : "notes"} to check
                  </summary>
                  {warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </details>
              )}
              {!readonly && (
                <div className="day-actions">
                  <button
                    className="text-link plain-button"
                    disabled={day.transfer}
                    onClick={() => {
                      commit(regenerateDay(trip, dayIndex, variant));
                      setVariant(variant + 1);
                    }}
                  >
                    <RefreshCw size={15} />
                    Regenerate day
                  </button>
                  <button
                    className="text-link plain-button"
                    onClick={() => {
                      setPlanB(!planB);
                      setProposal(null);
                      setRainPreview(null);
                    }}
                  >
                    <CloudRain size={16} />
                    Make a Plan B
                  </button>
                </div>
              )}
              {planB && (
                <div className="plan-b paper-note" id="plan-b-preview">
                  <h3>Keep the adventure flexible.</h3>
                  <p>
                    {rainPreview
                      ? "Review this rain alternative, its transfer allowances, and venue details before deciding."
                      : "Report a disruption manually. Locked stops and other days stay unchanged."}
                  </p>
                  {rainPreview&&<p>{rainPreviewOrigin==='manual'?'Based on your manual rain report. No forecast or official advisory has been inferred.':'A daily forecast planning signal prompted this idea. Review current local conditions and official advice before traveling.'}</p>}
                  <label>
                    What changed?
                    <select
                      value={scenario}
                      onChange={(e) => {
                        setScenario(e.target.value);
                        setProposal(null);
                        setRainPreview(null);
                      }}
                    >
                      {disruptions.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button small"
                    onClick={() => {
                      if(scenario==='Heavy rain'){
                        const rain=affectedRainActivities(trip,dayIndex).find(item=>item.alternative)?.alternative;
                        if(rain){previewRain(rain,'manual');return;}
                      }
                      setRainPreview(null);
                      setProposal(alternativePlan(trip, dayIndex, scenario));
                    }}
                  >
                    Preview alternative
                  </button>
                  {proposal && (
                    <div className="proposal">
                      <h4>
                        {changed.length} suggested changes ·{" "}
                        {peso(dayCost(proposal.days[dayIndex]))} revised day
                        estimate
                      </h4>
                      {changed.map((a) => (
                        <div key={a.id}>
                          <span className="old-plan">
                            {day.activities.find((x) => x.id === a.id)?.name}
                          </span>
                          <small>
                            Original:{" "}
                            {day.activities.find((x) => x.id === a.id)?.start}–
                            {endTime(
                              day.activities.find((x) => x.id === a.id)!,
                            )}{" "}
                            ·{" "}
                            {peso(
                              day.activities.find((x) => x.id === a.id)!.cost,
                            )}{" "}
                            <SourceIndicator
                              source={
                                day.activities.find((x) => x.id === a.id)!
                                  .sources.price
                              }
                              label="Original price"
                            />
                          </small>
                          <strong>→ {a.name}</strong>
                          <small>
                            {a.start}–{endTime(a)} · {peso(a.cost)}{" "}
                            <SourceIndicator
                              source={a.sources.price}
                              label="Replacement price"
                            />
                          </small>
                        </div>
                      ))}
                      {rainPreview && (
                        <div className="rain-preview-details">
                          <h4>Schedule & estimated cost difference</h4>
                          <p>{rainScheduleDifference(rainPreview)}</p>
                          <p>
                            {rainPreview.costDifference >= 0 ? "+" : "−"}
                            {peso(Math.abs(rainPreview.costDifference))}{" "}
                            estimated group cost difference. Fixed day
                            allowances stay as planned.
                          </p>
                          {rainPreview.notes.map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                          {rainPreview.replacement.openingHours && (
                            <p>
                              Published venue hours{" "}
                              <SourceIndicator
                                source={
                                  rainPreview.replacement.openingHours.source
                                }
                                label="Published opening hours"
                              />
                            </p>
                          )}
                          <SourceReviewNote />
                        </div>
                      )}
                      {!changed.length && (
                        <p>
                          No unlocked activities match this scenario. Review
                          locked bookings and transfer arrangements yourself.
                        </p>
                      )}
                      <p className="fine-print">
                        For transport cancellations, the remaining trip may need
                        new dates. This proposal does not verify replacement
                        connections or cancel bookings.
                      </p>
                      <div className="trip-toolbar">
                        <button
                          className="button small"
                          disabled={!changed.length}
                          onClick={confirmProposal}
                        >
                          Confirm & apply
                        </button>
                        <button
                          className="button secondary small"
                          onClick={() => {
                            setProposal(null);
                            setRainPreview(null);
                          }}
                        >
                          Keep original
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="timeline">
                {day.activities.map((a, i) => (
                  <article
                    id={`activity-${a.id}`}
                    className={`activity-card ${selected === a.id ? "selected" : ""}`}
                    key={a.id}
                  >
                    <button
                      className="activity-number"
                      aria-label={`Show ${a.name} on map`}
                      disabled={a.lat === null}
                      onClick={() => {
                        setSelected(a.id);
                        if (window.innerWidth <= 760) setTab("Map");
                      }}
                    >
                      {i + 1}
                    </button>
                    <div>
                      <span className="activity-time">
                        <Clock size={13} />
                        {a.start}–{endTime(a)}
                        {a.locked && (
                          <span className="locked-label">
                            <LockKeyhole size={12} />
                            Locked
                          </span>
                        )}
                      </span>
                      <h3>{a.name}</h3>
                      <p>{a.description}</p>
                      <span className="activity-meta">
                        {a.kind} · {peso(a.cost)} for the group{" "}
                        <SourceIndicator
                          source={a.sources.price}
                          label="Activity price"
                        />
                      </span>
                      <details className="activity-details">
                        <summary>Transport, booking & source</summary>
                        {a.geography&&<p>City / municipality: {a.geography.city_municipality} · Browsing destination: {a.geography.destination_group} <SourceIndicator source={a.geography.sources.municipality} label="Municipality" /></p>}
                        {a.entryPrice && <p>Entry price: {a.entryPrice.amount===null?"Unknown; confirm with the venue.":`${peso(a.entryPrice.amount)} per ${a.entryPrice.basis}`} <SourceIndicator source={a.entryPrice.source} label="Entry price" />. This is separate from the group's planning allowance above.</p>}
                        {a.visitMode!=="local"&&<p>Separate full-day outing. Confirm transfers, guides, permits and return arrangements. Included stops must not be added or charged again independently.</p>}
                        {!a.openingHours&&<p>Opening hours are unknown. Confirm access at the planned time.</p>}
                        <p>
                          Weather sensitivities:{" "}
                          {a.disruptionSensitivities.length
                            ? a.disruptionSensitivities
                                .map((t) =>
                                  t === "heavy-rain"
                                    ? "Rain"
                                    : t === "heat"
                                      ? "Heat (tag only)"
                                      : "Marine conditions (tag only)",
                                )
                                .join(", ")
                            : "None recorded; this does not establish that conditions are favorable."}
                        </p>
                        {a.openingHours && (
                          <p>
                            Published venue hours: {a.openingHours.opens}–
                            {a.openingHours.closes},{" "}
                            {a.openingHours.weekdays
                              .map(
                                (n) =>
                                  [
                                    "Sun",
                                    "Mon",
                                    "Tue",
                                    "Wed",
                                    "Thu",
                                    "Fri",
                                    "Sat",
                                  ][n],
                              )
                              .join(", ")}
                            . Check for changes and special closures.{" "}
                            <SourceIndicator
                              source={a.openingHours.source}
                              label="Published opening hours"
                            />
                          </p>
                        )}
                        <p>
                          {a.locationDetails}{" "}
                          <SourceIndicator
                            source={a.sources.location}
                            label="Location context"
                          />
                        </p>
                        <p>
                          Map coordinates{" "}
                          <SourceIndicator
                            source={a.sources.coordinates}
                            label="Map coordinates"
                          />
                        </p>
                        <p>
                          {a.transport}{" "}
                          <SourceIndicator
                            source={a.sources.transport}
                            label="Activity transport"
                          />
                        </p>
                        <p>
                          {a.accessibility}{" "}
                          <SourceIndicator
                            source={a.sources.accessibility}
                            label="Activity accessibility"
                          />
                        </p>
                        <p>
                          {a.booking}{" "}
                          <SourceIndicator
                            source={a.sources.booking}
                            label="Booking notes"
                          />
                        </p>
                        <p>
                          Proposed time and duration{" "}
                          <SourceIndicator
                            source={a.sources.schedule}
                            label="Activity schedule"
                          />
                        </p>
                        <p>
                          Activity description{" "}
                          <SourceIndicator
                            source={a.sources.description}
                            label="Activity description"
                          />
                        </p>
                        <AdvisorySources links={a.advisories} />
                        <SourceReviewNote />
                        <p>
                          {a.source} · {a.provenance}
                        </p>
                      </details>
                      <div className="activity-controls">
                        {a.lat !== null && (
                          <a
                            className="text-link"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=16/${a.lat}/${a.lng}`}
                          >
                            Location <ArrowUpRight size={13} />
                          </a>
                        )}
                        {!readonly && (
                          <>
                            <button
                              className="icon-button"
                              aria-label={`Edit ${a.name}`}
                              disabled={a.locked}
                              onClick={() => setEditor(a)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`${a.locked ? "Unlock" : "Lock"} ${a.name}`}
                              onClick={() =>
                                updateActivities(
                                  day.activities.map((x) =>
                                    x.id === a.id
                                      ? { ...x, locked: !x.locked }
                                      : x,
                                  ),
                                )
                              }
                            >
                              {a.locked ? (
                                <LockKeyhole size={14} />
                              ) : (
                                <LockKeyholeOpen size={14} />
                              )}
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Move ${a.name} up`}
                              disabled={
                                i === 0 ||
                                a.locked ||
                                day.activities[i - 1]?.locked
                              }
                              onClick={() => move(i, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Move ${a.name} down`}
                              disabled={
                                i === day.activities.length - 1 ||
                                a.locked ||
                                day.activities[i + 1]?.locked
                              }
                              onClick={() => move(i, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Remove ${a.name}`}
                              disabled={a.locked}
                              onClick={() =>
                                updateActivities(
                                  day.activities.filter((x) => x.id !== a.id),
                                )
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!readonly && (
                <div className="add-actions">
                  <button
                    className="button secondary"
                    onClick={() =>
                      setEditor(
                        blankActivity("My little detour", "10:00", "Activity"),
                      )
                    }
                  >
                    <Plus size={16} />
                    Add activity
                  </button>
                  <button
                    className="text-link plain-button"
                    onClick={() =>
                      setEditor(blankActivity("A local meal", "12:00", "Food"))
                    }
                  >
                    <Utensils size={16} />
                    Add meal
                  </button>
                  <button
                    className="text-link plain-button"
                    onClick={() =>
                      setEditor(blankActivity("A little rest", "15:00"))
                    }
                  >
                    <Coffee size={16} />
                    Add rest
                  </button>
                </div>
              )}
            </div>
            <aside className="map-column">
              <div className="map-heading">
                <MapPin size={18} />
                <h3>Your day, on the map.</h3>
              </div>
              <Suspense
                fallback={
                  <div className="map-loading">Unfolding your map…</div>
                }
              >
                <TripMap
                  key={day.id}
                  activities={day.activities}
                  slug={day.destination}
                  selected={selected}
                  onSelect={select}
                />
              </Suspense>
              <div className="paper-note map-note">
                <span className="handwritten">
                  A little room for the unexpected.
                </span>
                <p>
                  Times are planning blocks, not confirmed opening hours. Keep
                  transfer buffers and verify bookings before you go.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
      {tab === "Budget" && (
        <Budget trip={trip} readonly={readonly} commit={commit} />
      )}{" "}
      {tab === "Essentials" && (
        <Essentials trip={trip} readonly={readonly} commit={commit} draftNotes={!!record}/>
      )}
      <details className="provenance">
        <summary>About this itinerary & your saved preferences</summary>
        {trip.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        {Object.entries({
          Diet: trip.request.diet,
          Accessibility: trip.request.accessibility,
          Accommodation: trip.request.stay,
          "Activities to avoid": trip.request.avoid,
          "Must-visit places": trip.request.must,
          Reservations: trip.request.reservations,
          "Other requirements": trip.request.requirements,
        })
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <p key={k}>
              <strong>{k}:</strong> {v}
            </p>
          ))}
      </details>
      {editor && (
        <ActivityEditor
          slug={day.destination}
          request={trip.request}
          activity={editor}
          onClose={() => setEditor(null)}
          onSave={(a) => {
            const exists = day.activities.some((x) => x.id === a.id);
            updateActivities(
              exists
                ? day.activities.map((x) => (x.id === a.id ? a : x))
                : [...day.activities, a],
            );
            setEditor(null);
          }}
        />
      )}
      <div className="print-journal">
        <h2>Complete travel journal</h2>
        {trip.destinationInfo.map((d) => (
          <section key={d.slug}>
            <h3>{d.name} · destination sources</h3>
            <p>
              {d.locationDetails}{" "}
              <SourceIndicator
                source={d.sources.location}
                label="Location context"
              />
            </p>
            <p>
              {d.transport}{" "}
              <SourceIndicator
                source={d.sources.transport}
                label="Transport guidance"
              />
            </p>
            <p>
              {d.accessibility}{" "}
              <SourceIndicator
                source={d.sources.accessibility}
                label="Accessibility"
              />
            </p>
          </section>
        ))}
        {trip.days.map((d, i) => (
          <section key={d.id}>
            <h3>
              Day {i + 1} · {d.date} · {d.title}
            </h3>
            {d.activities.map((a) => (
              <div key={a.id}>
                <p>
                  {a.start}–{endTime(a)} · {a.name} · {peso(a.cost)} ·{" "}
                  {a.description}{" "}
                  <SourceIndicator source={a.sources.price} label="Price" />
                </p>
                <p>
                  {a.locationDetails}{" "}
                  <SourceIndicator
                    source={a.sources.location}
                    label="Location context"
                  />
                </p>
                <p>
                  {a.transport}{" "}
                  <SourceIndicator
                    source={a.sources.transport}
                    label="Transport"
                  />
                </p>
                <p>
                  {a.accessibility}{" "}
                  <SourceIndicator
                    source={a.sources.accessibility}
                    label="Accessibility"
                  />
                </p>
                <p>
                  Map coordinates{" "}
                  <SourceIndicator
                    source={a.sources.coordinates}
                    label="Map coordinates"
                  />{" "}
                  · Proposed time{" "}
                  <SourceIndicator
                    source={a.sources.schedule}
                    label="Schedule"
                  />
                </p>
                <AdvisorySources links={a.advisories} />
              </div>
            ))}
            <p>Day allowance: {peso(dayCost(d))}</p>
          </section>
        ))}
        <h3>Packing checklist</h3>
        {trip.checklist.map((c) => (
          <p key={c.id}>
            {c.done ? "☑" : "☐"} {c.text}
          </p>
        ))}
        <h3>Personal notes</h3>
        <p>{trip.notes}</p>
        <p>All prices and travel times are estimates requiring confirmation.</p>
        <SourceReviewNote />
      </div>
    </section>
  );
}
function Budget({
  trip,
  readonly,
  commit,
}: {
  trip: Trip;
  readonly: boolean;
  commit: (t: Trip) => void;
}) {
  const b = budgetSummary(trip);
  const [budgetDraft,setBudgetDraft]=useState("");
  const [budgetError,setBudgetError]=useState("");
  const [budgetEditing,setBudgetEditing]=useState(false);
  const budgetField=useRef<HTMLInputElement>(null);
  const colors = [
    "#167d8d",
    "#164b65",
    "#d1814d",
    "#6d9d78",
    "#bd9632",
    "#817596",
  ];
  return (
    <div className="budget-view">
      <div>
        <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
        <h2>
          Your adventure, <em>accounted for.</em>
        </h2>
        <p className="lede">
          Whole-group costs in pesos. Activity meals are added to the allowance
          for other meals.
        </p>
        <div className="budget-bars">
          {expenseCategories.map((c, i) => (
            <div key={c}>
              <div>
                <span>{c}</span>
                <strong>{peso(b.categories[c])}</strong>
              </div>
              <div className="bar-track">
                <span
                  style={{
                    width: `${b.planned ? Math.max(1, (b.categories[c] / b.planned) * 100) : 0}%`,
                    background: colors[i],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="budget-line">
          <span>Emergency reserve ({trip.request.reserve}%)</span>
          <strong>{peso(b.reserve)}</strong>
        </div>
        <div className="budget-line total">
          <span>Total planned + reserve</span>
          <strong>{peso(b.total)}</strong>
        </div>
        {!readonly && (
          <div className="trip-toolbar">
            <button
              className="button secondary small"
              onClick={() => commit(modifyBudget(trip, "cheaper"))}
            >
              Make it cheaper
            </button>
            <button
              className="button secondary small"
              onClick={() => commit(modifyBudget(trip, "upgrade"))}
            >
              Upgrade my stay allowance
            </button>
            <button
              className="button small"
              onClick={() => {setBudgetDraft(String(trip.request.budget));setBudgetError("");setBudgetEditing(true);}}
            >
              Adjust budget
            </button>
          </div>
        )}
        {budgetEditing&&<form noValidate className="paper-note" onSubmit={e=>{e.preventDefault();const amount=Number(budgetDraft);if(!Number.isInteger(amount)||amount<500||amount>2000000){setBudgetError("Choose a whole-peso budget from 500 to 2,000,000.");budgetField.current?.focus();return;}commit({...trip,request:{...trip.request,budget:amount}});setBudgetEditing(false);}}><label>Budget amount in pesos<input ref={budgetField} type="number" min={500} max={2000000} value={budgetDraft} aria-invalid={!!budgetError} aria-describedby={budgetError?"budget-amount-error":undefined} onChange={e=>setBudgetDraft(e.target.value)}/></label>{budgetError&&<p id="budget-amount-error" role="alert">{budgetError}</p>}<div className="trip-toolbar"><button className="button">Update budget</button><button type="button" className="button secondary" onClick={()=>setBudgetEditing(false)}>Cancel</button></div></form>}
        <p className="fine-print">
          “Make it cheaper” replaces unlocked optional paid stops with free
          time. Accommodation upgrades increase an allowance; they do not
          reserve a room.
        </p>
      </div>
      <div className="paper-note">
        <h3>The real-life numbers.</h3>
        <p>
          Track actual spending by category. Blank means not recorded; ₱0 is a
          recorded zero.
        </p>
        <div className="actual-table">
          <div>
            <strong>Category</strong>
            <strong>Actual (₱)</strong>
          </div>
          {expenseCategories.map((c) => (
            <label key={c}>
              <span>
                {c}
                <small>Planned: {peso(b.categories[c])}</small>
              </span>
              <input
                aria-label={`Actual ${c}`}
                type="number"
                min={0}
                max={10000000}
                step={1}
                disabled={readonly}
                value={trip.actual[c] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const actual = { ...trip.actual };
                  if (v === "") delete actual[c];
                  else if (
                    Number.isInteger(Number(v)) &&
                    Number(v) >= 0 &&
                    Number(v) <= 10000000
                  )
                    actual[c] = Number(v);
                  else return;
                  commit({ ...trip, actual });
                }}
              />
            </label>
          ))}
        </div>
        <div className="budget-line">
          <span>Recorded spending</span>
          <strong>{peso(b.actual)}</strong>
        </div>
        <p className="fine-print">
          {Object.keys(trip.actual).length} of {expenseCategories.length}{" "}
          categories recorded. Actual spending does not replace planned costs.
        </p>
        <h4>Edit fixed day allowances</h4>
        <label>
          Arrival / return flights allowance for the group (₱)
          <input
            type="number"
            min={0}
            max={10000000}
            step={1}
            disabled={readonly}
            value={trip.flightAllowance}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n <= 10000000)
                commit({ ...trip, flightAllowance: n });
            }}
          />
        </label>
        <p>
          Replace estimates with confirmed group costs. Changes recalculate
          immediately.
        </p>
        {trip.days.map((d, i) => (
          <details className="allowance-day" key={d.id}>
            <summary>
              Day {i + 1} · {peso(dayCost(d))}
            </summary>
            {(["stay", "food", "transport"] as const).map((key) => (
              <label key={key}>
                {key === "stay"
                  ? "Accommodation"
                  : key === "food"
                    ? "Other meals"
                    : "Transport"}{" "}
                (₱)
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  step={1}
                  disabled={readonly}
                  value={d[key]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isInteger(n) || n < 0 || n > 10000000) return;
                    const next = structuredClone(trip);
                    next.days[i][key] = n;
                    commit(next);
                  }}
                />
              </label>
            ))}
          </details>
        ))}
      </div>
    </div>
  );
}
function Essentials({
  trip,
  readonly,
  commit,
  draftNotes=false,
}: {
  trip: Trip;
  readonly: boolean;
  commit: (t: Trip) => void;
  draftNotes?:boolean;
}) {
  const [item, setItem] = useState("");
  const [notes, setNotes] = useState(trip.notes);
  return (
    <div className="essentials-view">
      <section>
        <span className="eyebrow">PACK A LITTLE PEACE OF MIND</span>
        <h2>
          Ready, set, <em>tara.</em>
        </h2>
        <p>
          {trip.checklist.filter((x) => x.done).length} of{" "}
          {trip.checklist.length} essentials packed
        </p>
        <div className="checklist">
          {trip.checklist.map((c) => (
            <div key={c.id}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={readonly}
                  onChange={() =>
                    commit({
                      ...trip,
                      checklist: trip.checklist.map((x) =>
                        x.id === c.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                />
                <span className={c.done ? "done" : ""}>{c.text}</span>
              </label>
              {!readonly && (
                <button
                  className="icon-button"
                  aria-label={`Remove checklist item ${c.text}`}
                  onClick={() =>
                    commit({
                      ...trip,
                      checklist: trip.checklist.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!readonly && (
          <form noValidate
            className="add-checklist"
            onSubmit={(e) => {
              e.preventDefault();
              if (item.trim()) {
                commit({
                  ...trip,
                  checklist: [
                    ...trip.checklist,
                    { id: uid(), text: item.trim(), done: false },
                  ],
                });
                setItem("");
              }
            }}
          >
            <input
              aria-label="New checklist item"
              maxLength={200}
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="One more thing to remember…"
            />
            <button
              className="button"
              disabled={!item.trim() || trip.checklist.length >= 100}
            >
              <Plus size={18} />
              Add
            </button>
          </form>
        )}
        <h3 className="notes-heading">Notes from your journey</h3>
        <label className="sr-only" htmlFor="journal-notes">
          Personal journal notes
        </label>
        <textarea style={{resize:"none",minHeight:100}}
          id="journal-notes"
          className="journal-notes"
          maxLength={20000}
          value={notes}
          readOnly={readonly}
          onChange={(e) => {setNotes(e.target.value);if(draftNotes)commit({...trip,notes:e.target.value});}}
          placeholder="A cafe you want to find. A moment you want to keep…"
        />
        {!readonly && (
          <button
            className="button small"
            onClick={() => commit({ ...trip, notes })}
          >
            Save journal notes <Check size={15} />
          </button>
        )}
      </section>
      <aside>
        <div className="paper-note">
          <h3>Before the adventure.</h3>
          <p>
            Requirements vary by route, nationality, and circumstances. This
            checklist is general preparation, not a verified entry assessment.
          </p>
          <h4>Documents & entry</h4>
          <p>
            Confirm accepted identification with your operator. For
            international arrival, check current passport, visa, and applicable
            eTravel procedures.
          </p>
          <AdvisorySources
            links={officialTravelLinks}
            note="Only these official portal links were checked. Your personal entry, visa, and registration requirements have not been assessed."
          />
          <AdvisorySources links={officialAdvisories} />
          <SourceReviewNote />
          <h4>Local arrangements</h4>
          <p>
            Confirm permits, environmental fees, baggage rules, insurance,
            accessibility, and terminal transfers directly. Store your
            operator’s confirmed emergency contact.
          </p>
          <h4>Weather</h4>
          <p>
            Check the day’s weather panel for forecast availability and PAGASA
            for official advisories. “Make a Plan B” lets you report a
            disruption. A generic forecast cannot establish marine safety.
          </p>
        </div>
      </aside>
    </div>
  );
}

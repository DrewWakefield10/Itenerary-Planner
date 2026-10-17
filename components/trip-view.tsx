"use client";
import { useEffect, useState, lazy, Suspense } from "react";
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
  Share2,
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
  const [trip, setTrip] = useState<Trip | null>(null);
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
  const [share, setShare] = useState("");
  const [variant, setVariant] = useState(1);
  useEffect(() => {
    setDayIndex(0);
    setHistory([]);
    setRainPreview(null);
    setReadonly(false);
    try {
      if (path.split("/")[2] === "shared") {
        const encoded = location.hash.slice(1);
        if (encoded.length > 180000)
          throw new Error("Shared plan is too large.");
        const data = JSON.parse(decodeURIComponent(atob(encoded)));
        setTrip(tripSchema.parse(data));
        setReadonly(true);
      } else
        setTrip(readTrips().find((t) => t.id === path.split("/")[2]) || null);
    } catch {
      setMessage("This shared trip is invalid or incomplete.");
    }
    setTab(
      path.endsWith("/budget")
        ? "Budget"
        : path.endsWith("/essentials")
          ? "Essentials"
          : "Itinerary",
    );
    setLoaded(true);
  }, [path]);
  function commit(next: Trip) {
    if (!trip || readonly) return;
    const parsed = tripSchema.safeParse(next);
    if (!parsed.success) {
      setMessage(
        "That change is invalid. Check amounts, times, and text lengths.",
      );
      return;
    }
    if (!saveTrip(parsed.data)) {
      setMessage(
        "Could not save this change. The previous version is preserved.",
      );
      return;
    }
    setHistory([...history.slice(-19), trip]);
    setTrip(parsed.data);
    setMessage("Saved to your travel journal.");
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
  if (!trip)
    return (
      <div className="page empty">
        <BookOpen size={40} />
        <h2>This trip isn’t in this browser.</h2>
        <p>
          {message || "Open a saved journal here, or start a new adventure."}
        </p>
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
          {readonly ? "Read-only shared snapshot" : "Saved on this browser"}
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
              const title = prompt("Trip title", trip.title);
              if (title?.trim())
                commit({ ...trip, title: title.trim().slice(0, 160) });
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
              onClick={() => {
                const sanitized = {
                  ...trip,
                  notes: "",
                  request: {
                    ...trip.request,
                    diet: "",
                    accessibility: "",
                    reservations: "",
                    requirements: "",
                  },
                };
                const hash = btoa(
                  encodeURIComponent(JSON.stringify(sanitized)),
                );
                if (hash.length > 120000) {
                  setMessage(
                    "This trip is too large for a share link. Export a backup instead.",
                  );
                  return;
                }
                setShare(`${location.origin}/trips/shared#${hash}`);
              }}
            >
              <Share2 size={16} />
              Share snapshot
            </button>
            <button
              className="button secondary small"
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1)!;
                if (saveTrip(previous)) {
                  setTrip(previous);
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
      {message && (
        <div className="notice" role="status">
          {message}
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            <X size={15} />
          </button>
        </div>
      )}
      {share && (
        <div className="share-panel paper-note">
          <h3>A little postcard for your people.</h3>
          <p>
            Anyone with this link and access to the site can read this snapshot.
            Private preference fields and journal notes are omitted; activity
            notes, dates, checklist, and costs remain. Review before sharing.
          </p>
          <label>
            Read-only trip link
            <input readOnly value={share} onFocus={(e) => e.target.select()} />
          </label>
          <div className="trip-toolbar">
            <button
              className="button small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(share);
                  setMessage("Read-only link copied.");
                } catch {
                  setMessage("Select and copy the link manually.");
                }
              }}
            >
              Copy link
            </button>
            <button
              className="button secondary small"
              onClick={() => setShare("")}
            >
              Close
            </button>
          </div>
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
        <Essentials trip={trip} readonly={readonly} commit={commit} />
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
              onClick={() => {
                const amount = prompt(
                  `Budget amount in pesos (${trip.request.budgetMode === "total" ? "whole group" : "per person"})`,
                  String(trip.request.budget),
                );
                if (
                  amount !== null &&
                  Number.isInteger(Number(amount)) &&
                  Number(amount) >= 500 &&
                  Number(amount) <= 2000000
                )
                  commit({
                    ...trip,
                    request: { ...trip.request, budget: Number(amount) },
                  });
              }}
            >
              Adjust budget
            </button>
          </div>
        )}
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
}: {
  trip: Trip;
  readonly: boolean;
  commit: (t: Trip) => void;
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
          <form
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
        <textarea
          id="journal-notes"
          className="journal-notes"
          maxLength={20000}
          value={notes}
          readOnly={readonly}
          onChange={(e) => setNotes(e.target.value)}
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

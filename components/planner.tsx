"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  selectableDestinations,
  destinationImage,
  personalities,
  destination,
  peso,
} from "@/lib/destinations";
import { defaultRequest, requestSchema, type TripRequest } from "@/lib/trip";
import { travelers } from "@/lib/engine";
import { readLocal, writeLocal } from "@/lib/storage";
import { saveTrip } from "@/lib/trip-storage";
import { placeTypes, placeTypeLabels } from "@/lib/catalog/place-types";
import {
  plannerEntry,
  readPlannerDraft,
  readPlannerPrefill,
  applyPlannerPrefill,
  clearPlannerPrefillQuery,
  type PlannerPrefill,
} from "@/lib/planner-entry";
import ConfirmDialog from "./confirm-dialog";
import { discoveryPlace } from "@/lib/discovery";
import {
  emptyManualDraft,
  finishManualTrip,
  isTimed,
  layoutManualDays,
  manualDayWarnings,
  manualBudgetTotals,
  manualDraftSchema,
  type ManualDraft,
} from "@/lib/manual-planning";
import {
  ManualBudgetFields,
  ManualItinerary,
  type GapTarget,
} from "./manual-itinerary";
import ManualSuggestions from "./manual-suggestions";
// Keep the stored review index so drafts from the seven-step planner can resume.
const steps = [
  { key: 0, label: "The basics" },
  { key: 1, label: "Your itinerary" },
  { key: 6, label: "Review & save" },
];
export default function Planner() {
  const router = useRouter();
  const query = useSearchParams().toString();
  const [r, setR] = useState<TripRequest>({
    ...defaultRequest,
    destinations: [],
  });
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draft, setDraft] = useState<ManualDraft>(emptyManualDraft);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [direct, setDirect] = useState<GapTarget | null>(null);
  const initialized = useRef(false);
  const [error, setError] = useState("");

  const [pendingPrefill, setPendingPrefill] = useState<PlannerPrefill | null>(
    null,
  );
  const [prefillMode, setPrefillMode] = useState<"replace" | "add">("replace");
  const [useSuggestedDays, setUseSuggestedDays] = useState(false);
  const [invalidDraft, setInvalidDraft] = useState(false);
  const hasLegacyBase = r.destinations.some(
    (slug) => destination(slug)?.legacyOnly,
  );
  const tripRoute = r.destinations
    .map((slug) => destination(slug)?.name)
    .join(" → ");
  const baseGroups = [
    {
      name: "Palawan",
      choices: selectableDestinations.filter((d) => d.province === "Palawan"),
    },
    {
      name: "More destinations",
      choices: selectableDestinations.filter((d) => d.province !== "Palawan"),
    },
  ];
  useEffect(() => {
    if (
      initialized.current &&
      !["place", "destinations", "days"].some((key) =>
        new URLSearchParams(query).has(key),
      )
    )
      return;
    const rawDraft = readPlannerDraft();
    const entry = plannerEntry(
      rawDraft,
      query,
      readLocal("preferred-pace", "Balanced"),
    );
    const parsedDraft = manualDraftSchema.safeParse(
      readLocal("manual-planner", null),
    );
    const place = discoveryPlace(new URLSearchParams(query).get("place") || "");
    const prefill = readPlannerPrefill(query);
    const request =
      rawDraft === null
        ? {
            ...entry.request,
            ...prefill,
            destinations:
              prefill.destinations ?? (place?.baseSlug ? [place.baseSlug] : []),
            interests: [],
          }
        : entry.request;
    const valid = requestSchema.safeParse(request);
    const ready =
      valid.success &&
      request.destinations.every((slug) => !destination(slug)?.legacyOnly);
    if (!initialized.current && entry.draftValid) {
      initialized.current = true;
      const saved = parsedDraft.success ? parsedDraft.data : emptyManualDraft;
      setDraft(
        ready
          ? { ...saved, days: layoutManualDays(valid.data, saved.days) }
          : saved,
      );
      setStep(
        !ready ? 0 : place?.directory ? 1 : saved.step > 1 ? 6 : saved.step,
      );
    }
    if (place?.directory) {
      setIncoming(place.id);
      if (ready) setStep(1);
    }
    setR(request);
    setPendingPrefill(entry.draftValid ? entry.proposal : null);
    setPrefillMode("replace");
    setUseSuggestedDays(false);
    setError("");
    setInvalidDraft(!entry.draftValid);
    setLoaded(entry.draftValid);
    if (
      rawDraft === null &&
      ready &&
      (prefill.destinations || prefill.days) &&
      writeLocal("draft", valid.data)
    ) {
      clearPlannerPrefillQuery(query);
    }
  }, [query]);
  useEffect(() => {
    if (loaded && !pendingPrefill && !invalidDraft) {
      const choices = requestSchema.safeParse(r);
      setDraftSaved(
        choices.success &&
          writeLocal("draft", choices.data) &&
          writeLocal("manual-planner", { ...draft, step }),
      );
    }
  }, [r, draft, step, loaded, pendingPrefill, invalidDraft]);
  function closeIncoming() {
    setIncoming(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("place");
    window.history.replaceState(
      null,
      "",
      "/planner" + (params.size ? "?" + params : ""),
    );
  }
  function consumePrefill() {
    clearPlannerPrefillQuery(query);
  }
  function keepDraft() {
    setPendingPrefill(null);
    setError("");
    consumePrefill();
  }
  function acceptPrefill() {
    if (!pendingPrefill) return;
    try {
      const next = applyPlannerPrefill(
        r,
        pendingPrefill,
        prefillMode,
        useSuggestedDays,
      );
      if (!writeLocal("draft", next)) {
        setError(
          "Your draft could not be saved. Your previous choices have been kept.",
        );
        return;
      }
      setR(next);
      setDraft((current) => ({
        ...current,
        days: layoutManualDays(next, current.days),
      }));
      setPendingPrefill(null);
      setError("");
      consumePrefill();
    } catch (e) {
      setError(
        e instanceof Error
          ? "issues" in e
            ? (e as { issues: { message: string }[] }).issues
                .map((i) => i.message)
                .join(" ")
            : e.message
          : "These choices do not fit the current trip. Check the number of bases and days.",
      );
    }
  }
  function change<K extends keyof TripRequest>(key: K, value: TripRequest[K]) {
    setR({ ...r, [key]: value });
    setError("");
  }
  function goTo(target: number) {
    if (target > 0 && (step === 0 || !draft.days.length)) {
      if (!r.destinations.length) {
        setError("Choose at least one place to stay.");
        document.getElementById("planner-destinations")?.focus();
        return;
      }
      if (hasLegacyBase) {
        setError(
          "Choose an explicit overnight base to replace the legacy Palawan selection for this new trip.",
        );
        return;
      }
      const parsed = requestSchema.safeParse(r);
      if (!parsed.success) {
        setError(parsed.error.issues.map((issue) => issue.message).join(" "));
        return;
      }
      setDraft({ ...draft, days: layoutManualDays(parsed.data, draft.days) });
    }
    setStep(target);
    setDirect(null);
    setError("");
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      document
        .getElementById("planner-chapter")
        ?.focus({ preventScroll: true }),
    );
  }
  const budgetTotals =
    step === 6
      ? manualBudgetTotals(draft.days.slice(0, r.days), draft.budget)
      : null;
  function finish() {
    try {
      const trip = finishManualTrip(r, draft);
      if (!saveTrip(trip))
        throw new Error(
          "This browser could not save the itinerary. Your planner draft is still open.",
        );
      router.push(`/trips/${trip.id}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not finish this draft.",
      );
    }
  }
  if (invalidDraft)
    return (
      <section className="page section narrow">
        <h1 className="page-title">
          Your saved <em>planner draft.</em>
        </h1>
        <div className="paper-note" role="alert">
          <p>
            The saved draft could not be read or validated. It has not been
            overwritten. Saved itineraries are separate and remain in My Trips.
          </p>
          <button
            className="button"
            onClick={() => {
              const fresh = plannerEntry(
                null,
                query,
                readLocal("preferred-pace", "Balanced"),
              ).request;
              if (writeLocal("draft", fresh)) {
                initialized.current = true;
                setR(fresh);
                setStep(0);
                setDraft({
                  ...emptyManualDraft,
                  days: layoutManualDays(fresh, []),
                });
                setInvalidDraft(false);
                setLoaded(true);
                consumePrefill();
              } else
                setError(
                  "Storage is unavailable. The existing draft has been kept.",
                );
            }}
          >
            Start a new planner draft
          </button>
          {error && <p>{error}</p>}
          <Link href="/my-trips" className="text-link">
            Open My Trips
          </Link>
        </div>
      </section>
    );
  return (
    <section className="page section planner-page">
      {pendingPrefill && (
        <ConfirmDialog
          title="Use these choices for your draft?"
          action="Apply to planner draft"
          cancelLabel="Keep my draft"
          onClose={keepDraft}
          onConfirm={acceptPrefill}
        >
          <p>
            Your existing planner draft has been kept. Budget, dates, pace,
            interests and other preferences will stay as entered.
          </p>
          <p>
            <strong>Current:</strong>{" "}
            {r.destinations.map((s) => destination(s)?.name).join(", ")} /{" "}
            {r.days} days
          </p>
          <p>
            <strong>From this link:</strong>{" "}
            {pendingPrefill.destinations
              ?.map((s) => destination(s)?.name)
              .join(", ") || "Current destinations"}
            {pendingPrefill.days
              ? ` / ${pendingPrefill.days} days suggested`
              : ""}
          </p>
          {pendingPrefill.destinations && (
            <fieldset className="prefill-options">
              <legend>How should these destinations fit?</legend>
              <label>
                <input
                  type="radio"
                  name="prefill-mode"
                  checked={prefillMode === "replace"}
                  onChange={() => setPrefillMode("replace")}
                />{" "}
                Use the destinations from this link
              </label>
              <label>
                <input
                  type="radio"
                  name="prefill-mode"
                  checked={prefillMode === "add"}
                  onChange={() => setPrefillMode("add")}
                />{" "}
                Add to my existing destinations
              </label>
              <small>
                The existing three-base and minimum-duration limits still apply.
              </small>
            </fieldset>
          )}
          {pendingPrefill.days && (
            <label className="prefill-days">
              <input
                type="checkbox"
                checked={useSuggestedDays}
                onChange={(e) => setUseSuggestedDays(e.target.checked)}
              />{" "}
              Use the suggested {pendingPrefill.days}-day duration
            </label>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </ConfirmDialog>
      )}
      <h1 className="page-title">
        Plan a <em>trip.</em>
      </h1>
      <div className="planner-layout">
        <nav className="planner-sidebar" aria-label="Trip planning steps">
          <ol>
            {steps.map(({ key, label }, index) => (
              <li
                className={
                  key === step ? "current" : key < step ? "complete" : ""
                }
                key={key}
              >
                <button
                  type="button"
                  disabled={!loaded || !!pendingPrefill}
                  aria-current={key === step ? "step" : undefined}
                  onClick={() => goTo(key)}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="planner-paper">
          <div className="paper-top">
            <span>
              Step {steps.findIndex((item) => item.key === step) + 1} of{" "}
              {steps.length}
            </span>
            {draftSaved && <span>Draft saved in this browser</span>}
          </div>
          {step > 0 && (
            <p className="planner-trip-summary">
              <strong>{tripRoute}</strong>
              <span>
                {r.days} days · {travelers(r)}{" "}
                {travelers(r) === 1 ? "traveler" : "travelers"}
              </span>
            </p>
          )}
          {step === 0 && (
            <>
              <h2 id="planner-chapter" tabIndex={-1}>
                The basics
              </h2>
              <h3 id="planner-destinations" tabIndex={-1}>
                Where will you stay?
              </h3>
              <p>Choose up to three places, in the order you’ll visit them.</p>
              {tripRoute && (
                <p aria-live="polite">
                  <strong>Selected</strong> · {tripRoute}
                </p>
              )}
              {hasLegacyBase && (
                <p className="legacy-base-note" role="status">
                  Your draft uses the older “Palawan” label. Saved trips remain
                  readable. For this new trip, choose an explicit overnight base
                  below; choosing a base replaces that legacy selection.
                </p>
              )}
              {baseGroups.map((group) => (
                <section
                  className="destination-group"
                  key={group.name}
                  aria-label={group.name}
                >
                  <h3>{group.name}</h3>
                  <div className="destination-choices">
                    {group.choices.map((d) => (
                      <button
                        aria-label={d.name}
                        aria-describedby={
                          r.destinations.includes(d.slug)
                            ? `visit-order-${d.slug}`
                            : undefined
                        }
                        aria-pressed={r.destinations.includes(d.slug)}
                        className={
                          r.destinations.includes(d.slug) ? "selected" : ""
                        }
                        key={d.slug}
                        onClick={() => {
                          const current = r.destinations.filter(
                            (slug) => !destination(slug)?.legacyOnly,
                          );
                          const picks = current.includes(d.slug)
                            ? current.filter((x) => x !== d.slug)
                            : [...current, d.slug];
                          if (picks.length <= 3) change("destinations", picks);
                          else
                            setError(
                              "Choose up to three overnight bases. Remove a selected base before adding another.",
                            );
                        }}
                      >
                        <img src={destinationImage(d.slug)} alt="" />
                        <span>{d.name}</span>
                        {r.destinations.includes(d.slug) && (
                          <b id={`visit-order-${d.slug}`}>
                            <span className="sr-only">Visit order </span>
                            {r.destinations.indexOf(d.slug) + 1}
                          </b>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {r.destinations.length > 1 && (
                <p className="fine-print">
                  We’ll set aside a travel day between each pair of
                  destinations.
                </p>
              )}
              <h3>When are you going?</h3>
              <div className="form-grid">
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
            </>
          )}
          {step === 1 && (
            <>
              <h2 id="planner-chapter" tabIndex={-1}>
                Your itinerary
              </h2>
              <p>
                Pick a day, then add places you want to visit. You can leave any
                day open.
              </p>
              <ManualItinerary
                request={r}
                draft={draft}
                change={setDraft}
                placeId={pendingPrefill ? null : incoming}
                closeIncoming={closeIncoming}
                editBasics={() => goTo(0)}
                suggest={setDirect}
              />
              {direct && (
                <ConfirmDialog
                  title="Suggestions for this gap"
                  cancelLabel="Close"
                  action="Done"
                  onClose={() => setDirect(null)}
                  onConfirm={() => setDirect(null)}
                >
                  <ManualSuggestions
                    request={r}
                    draft={draft}
                    change={setDraft}
                    direct={direct}
                    editItinerary={() => setDirect(null)}
                  />
                </ConfirmDialog>
              )}
            </>
          )}
          {step === 6 && (
            <>
              <h2 id="planner-chapter" tabIndex={-1}>
                Review &amp; save
              </h2>
              <p>
                Starting {r.startDate}. You can save now and fill in more days
                later.
              </p>
              {draft.days
                .slice(r.days)
                .some((d) => d.activities.length || d.windows?.length) && (
                <p className="notice">
                  Review the days outside your current duration in Your
                  itinerary before finishing.
                </p>
              )}
              <ol className="manual-review">
                {draft.days.slice(0, r.days).map((d, index) => (
                  <li key={d.id}>
                    <strong>
                      Day {index + 1} · {d.title} · {d.date}
                    </strong>
                    <p>
                      {d.activities.length
                        ? d.activities
                            .map(
                              (a) =>
                                `${isTimed(a) ? a.start + " " : ""}${a.name}${a.locked ? " (fixed)" : ""}`,
                            )
                            .join(" · ")
                        : "Open day"}
                    </p>
                    {manualDayWarnings(d, r).map((warning) => (
                      <p className="fine-print" key={warning}>
                        {warning}
                      </p>
                    ))}
                  </li>
                ))}
              </ol>
              <button className="text-link" onClick={() => goTo(1)}>
                Edit your itinerary
              </button>
              {budgetTotals && (
                <p className="planner-trip-summary">
                  <strong>
                    Known group cost: {peso(budgetTotals.planned)}
                  </strong>
                  {budgetTotals.unknown > 0 && (
                    <span>Some activity costs are still unknown.</span>
                  )}
                </p>
              )}
              <details className="planner-preferences">
                <summary>Trip preferences (optional)</summary>
                <details>
                  <summary>Travel style</summary>
                  <p>Pick the interests to use when you ask for suggestions.</p>
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
                  <details
                    className="paper-note"
                    open={r.activityCategories.length > 0}
                  >
                    <summary>Choose specific place types (optional)</summary>
                    <p className="fine-print">
                      Select any types you want to visit. These take priority
                      over broad interests. Only matching places are suggested;
                      a beach bar does not count as a beach. Limited matches
                      leave open time.
                    </p>
                    <fieldset>
                      <legend>Place types</legend>
                      <div className="place-type-options">
                        {placeTypes.map((type) => (
                          <label className="check-label" key={type}>
                            <input
                              type="checkbox"
                              checked={r.activityCategories.includes(type)}
                              onChange={(e) =>
                                change(
                                  "activityCategories",
                                  e.target.checked
                                    ? [...r.activityCategories, type]
                                    : r.activityCategories.filter(
                                        (t) => t !== type,
                                      ),
                                )
                              }
                            />
                            {placeTypeLabels[type]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </details>
                </details>
                <details>
                  <summary>Budget</summary>
                  <ManualBudgetFields draft={draft} change={setDraft} />
                </details>
                <details>
                  <summary>Pace</summary>
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
                      [
                        "Packed",
                        "Up to three nearby stops when the day allows.",
                      ],
                    ].map(([p, desc]) => (
                      <button
                        key={p}
                        className={r.pace === p ? "selected" : ""}
                        aria-pressed={r.pace === p}
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
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={r.includeExcursions}
                      onChange={(e) =>
                        change("includeExcursions", e.target.checked)
                      }
                    />{" "}
                    Include separate full-day excursions or tour proposals
                  </label>
                  <p className="fine-print">
                    Opt in to reserve entire days for outlying visits. Routes,
                    guides, permits and availability need confirmation; no
                    booking is made.
                  </p>
                </details>
                <details>
                  <summary>Trip details</summary>
                  <p>
                    Optional details. Saved with your trip; local suitability
                    and bookings need confirmation.
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
                        <textarea
                          className="resize-none"
                          style={{ resize: "none", minHeight: 100 }}
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
                    Add exact booked times as fixed reservations in Your
                    itinerary. Free-text reservations are saved as notes.
                  </p>
                </details>
              </details>
              <details className="manual-help-disclosure">
                <summary>Suggest additions</summary>
                <ManualSuggestions
                  request={r}
                  draft={draft}
                  change={setDraft}
                  editItinerary={() => goTo(1)}
                />
              </details>
            </>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="planner-actions">
            {step > 0 && (
              <button
                className="text-link plain-button"
                onClick={() => goTo(step === 1 ? 0 : 1)}
              >
                <ArrowLeft size={17} /> Back
              </button>
            )}
            {step < 6 ? (
              <button
                className="button"
                disabled={!loaded || !!pendingPrefill}
                onClick={() => goTo(step === 0 ? 1 : 6)}
              >
                {step === 0 ? "Plan my days" : "Review trip"}{" "}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button"
                disabled={!loaded || !!pendingPrefill}
                onClick={finish}
              >
                Save my itinerary <ArrowRight size={17} />
              </button>
            )}
          </div>
          {step === 6 && (
            <p className="fine-print">
              Your itinerary saves in this browser. You can also save it to your
              Google account after opening it.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

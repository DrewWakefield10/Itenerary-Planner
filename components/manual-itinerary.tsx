"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  directoryCategories,
  destinationGroups,
  filterDirectory,
} from "@/lib/catalog/directory";
import {
  discoveryPlace,
  discoveryStop,
  type DiscoveryPlace,
} from "@/lib/discovery";
import { destination, peso } from "@/lib/destinations";
import { blankActivity, endTime, uid } from "@/lib/engine";
import {
  activityCostLabel,
  catalogActivity,
  dayWindows,
  isTimed,
  manualBudgetTotals,
  manualDayWarnings,
  manualDefaults,
  misplaced,
  type ManualDraft,
} from "@/lib/manual-planning";
import {
  activitySchema,
  expenseCategories,
  planningWindowSchema,
  type Activity,
  type TripDay,
  type TripRequest,
} from "@/lib/trip";
import { PlacePhoto } from "./place-media";
import { SourceIndicator } from "./source-indicator";
import ConfirmDialog from "./confirm-dialog";
import { updateActivityField } from "@/lib/activity-sources";

type Window = NonNullable<TripDay["windows"]>[number];
export type GapTarget = { dayId: string; windowId: string };
type BoardProps = {
  request: TripRequest;
  draft: ManualDraft;
  change: (draft: ManualDraft) => void;
  placeId?: string | null;
  closeIncoming?: () => void;
  suggest?: (target: GapTarget) => void;
};

export function ManualBudgetSummary({ draft }: { draft: ManualDraft }) {
  const totals = manualBudgetTotals(draft.days, draft.budget);
  return (
    <div className="manual-budget paper-note">
      <dl>
        <div>
          <dt>Estimated cost of what you’ve planned</dt>
          <dd>{peso(totals.planned)}</dd>
        </div>
        <div>
          <dt>Additional budget for suggestions</dt>
          <dd>
            {draft.budget.additional === null
              ? "No cap entered"
              : peso(draft.budget.additional)}
          </dd>
        </div>
        <div>
          <dt>Estimated combined trip cost</dt>
          <dd>
            {peso(totals.combined)}
            {totals.remaining === null ? " + optional additions" : ""}
          </dd>
        </div>
        {draft.budget.limit !== null && (
          <div>
            <dt>Estimated remainder after planned costs</dt>
            <dd>{peso(draft.budget.limit - totals.planned)}</dd>
          </div>
        )}
      </dl>
      <p className="fine-print">
        Whole-trip group totals in Philippine pesos.{" "}
        {totals.spentOnSuggestions > 0 &&
          `${peso(totals.spentOnSuggestions)} of accepted suggestions is already in planned costs. `}
        {totals.unknown
          ? `${totals.unknown} activities have unknown costs. `
          : ""}
        Add transport, accommodation and other expenses as items when known.
      </p>
    </div>
  );
}
export function ManualBudgetFields({
  draft,
  change,
}: Pick<BoardProps, "draft" | "change">) {
  function update(key: keyof ManualDraft["budget"], value: string) {
    if (!value || (/^\d+$/.test(value) && Number(value) <= 10000000))
      change({
        ...draft,
        budget: { ...draft.budget, [key]: value ? Number(value) : null },
      });
  }
  return (
    <>
      <ManualBudgetSummary draft={draft} />
      <div className="form-grid manual-budget-fields">
        <label>
          Additional budget for suggestions (₱)
          <input
            type="number"
            min="0"
            max="10000000"
            placeholder="Optional"
            value={draft.budget.additional ?? ""}
            onChange={(e) => update("additional", e.target.value)}
          />
        </label>
        <label>
          Overall trip limit (₱)
          <input
            type="number"
            min="0"
            max="10000000"
            placeholder="Optional"
            value={draft.budget.limit ?? ""}
            onChange={(e) => update("limit", e.target.value)}
          />
        </label>
      </div>
    </>
  );
}

export function CatalogPreview({
  place,
  request,
  children,
}: {
  place: DiscoveryPlace;
  request: TripRequest;
  children?: ReactNode;
}) {
  const stop = discoveryStop(place),
    fee = stop?.entryPrice;
  return (
    <article className="manual-place">
      <div className="discovery-photo">
        <PlacePhoto place={place} />
      </div>
      <div>
        <h4>{place.name}</h4>
        <p className="fine-print">
          {place.category} ·{" "}
          {place.directory?.city_municipality ??
            destination(place.baseSlug)?.name}
        </p>
        <p>{place.description}</p>
        <p className="fine-print">
          {stop ? `About ${stop.minutes} min` : "Visit duration unknown"} ·{" "}
          {fee?.amount == null
            ? "Cost unknown"
            : `${peso(fee.amount * (fee.basis === "person" ? request.adults + request.children : 1))} for the group (entry)`}
          {fee?.amount != null && (
            <>
              {" "}
              <SourceIndicator label="Entry price" source={fee.source} />
            </>
          )}
        </p>
        {place.image && (
          <a
            className="text-link"
            href={place.image.creditUrl}
            target="_blank"
            rel="noreferrer"
          >
            Photo credit ↗
          </a>
        )}
        <div className="trip-toolbar">
          <Link
            className="text-link"
            href={`/discover/${place.id}`}
            target="_blank"
            rel="noopener"
          >
            Place details ↗
          </Link>
          {children}
        </div>
      </div>
    </article>
  );
}

function ActivityForm({
  initial,
  onSave,
  onClose,
  children,
}: {
  initial: Activity;
  onSave: (activity: Activity) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activity, setActivity] = useState(initial);
  const [time, setTime] = useState(
    initial.manual?.flexible ? "" : initial.start,
  );
  const [duration, setDuration] = useState(
    initial.manual?.durationUnknown ? "" : String(initial.duration),
  );
  const [cost, setCost] = useState(
    initial.manual?.price === "unknown" ? "" : String(initial.cost),
  );
  const [confirmed, setConfirmed] = useState(
    initial.manual?.price === "confirmed",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="editor-dialog manual-editor"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="manual-editor-title"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const timing = updateActivityField(
            updateActivityField(activity, "start", time || "09:00"),
            "duration",
            duration ? Number(duration) : 15,
          );
          const value = updateActivityField(
            timing,
            "cost",
            cost ? Number(cost) : 0,
          );
          const priceChanged =
            cost !==
              (initial.manual?.price === "unknown"
                ? ""
                : String(initial.cost)) ||
            confirmed !== (initial.manual?.price === "confirmed");
          const parsed = activitySchema.safeParse({
            ...value,
            name: activity.name.trim(),
            manual: {
              ...activity.manual,
              flexible: !time,
              durationUnknown: !duration,
              price:
                cost === "" ? "unknown" : confirmed ? "confirmed" : "estimate",
              ...(priceChanged
                ? { entryUnknown: false, groupSizeAtEstimate: undefined }
                : {}),
            },
          });
          if (!parsed.success || (time && !duration)) {
            setError(
              "Enter a name, a duration of 15–720 minutes for a timed activity, and a valid whole-peso amount if known.",
            );
            return;
          }
          try {
            onSave(parsed.data);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not save this activity.",
            );
          }
        }}
      >
        <h2 id="manual-editor-title">
          {initial.manual?.placeId ? "Plan this visit" : "Activity details"}
        </h2>
        {children}
        <label>
          Activity name
          <input
            autoFocus
            required
            maxLength={160}
            readOnly={!!activity.catalogStopId || !!activity.manual?.placeId}
            value={activity.name}
            onChange={(e) => setActivity({ ...activity, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Start time (optional)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label>
            Visit length in minutes
            <input
              type="number"
              min={15}
              max={720}
              placeholder="Unknown"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label>
            Group cost (₱)
            <input
              type="number"
              min={0}
              max={10000000}
              placeholder="Unknown"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label>
            Expense category
            <select
              value={activity.category}
              onChange={(e) =>
                setActivity({
                  ...activity,
                  category: e.target.value as Activity["category"],
                })
              }
            >
              {expenseCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Confirmed cost
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={activity.locked}
              onChange={(e) =>
                setActivity({ ...activity, locked: e.target.checked })
              }
            />{" "}
            Fixed commitment
          </label>
        </div>
        <label>
          Notes
          <textarea
            className="resize-none"
            maxLength={1500}
            value={activity.description}
            onChange={(e) =>
              setActivity(
                updateActivityField(activity, "description", e.target.value),
              )
            }
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="trip-toolbar">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" type="submit">
            Save activity
          </button>
        </div>
      </form>
    </dialog>
  );
}

function WindowForm({
  initial,
  save,
  cancel,
}: {
  initial: Window;
  save: (value: Window) => void;
  cancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [window, setWindow] = useState(initial),
    [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="editor-dialog"
      ref={ref}
      aria-labelledby="time-window-heading"
      onCancel={cancel}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = planningWindowSchema.safeParse(window);
          if (!parsed.success) {
            setError("Enter a start and a later end time.");
            return;
          }
          try {
            save(parsed.data);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not save this window.",
            );
          }
        }}
      >
        <h2 id="time-window-heading">Time window</h2>
        <p>Choose times you are comfortable setting aside on this day.</p>
        <div className="form-grid">
          <label>
            Window start
            <input
              type="time"
              value={window.start}
              onChange={(e) => setWindow({ ...window, start: e.target.value })}
            />
          </label>
          <label>
            Window end
            <input
              type="time"
              value={window.end}
              onChange={(e) => setWindow({ ...window, end: e.target.value })}
            />
          </label>
          <label>
            Use this time for
            <select
              value={window.intent}
              onChange={(e) =>
                setWindow({
                  ...window,
                  intent: e.target.value as Window["intent"],
                })
              }
            >
              <option value="free">Keep free</option>
              <option value="open">Open to suggestions</option>
              <option value="unplanned">Unplanned</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="trip-toolbar">
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="button">Save time window</button>
        </div>
      </form>
    </dialog>
  );
}

export function ManualItinerary({
  request,
  draft,
  change,
  placeId,
  closeIncoming,
  suggest,
}: BoardProps) {
  const [preview, setPreview] = useState<string | null>(null),
    [editor, setEditor] = useState<Activity | null>(null);
  const [window, setWindow] = useState<Window | null>(null),
    [error, setError] = useState("");
  const [remove, setRemove] = useState<Activity | null>(null),
    [snapshotDay, setSnapshotDay] = useState(-1);
  const [previewDay, setPreviewDay] = useState(-1);
  const dayIndex = Math.min(draft.selectedDay, draft.days.length - 1),
    day = draft.days[dayIndex];
  if (!day) return null;
  const currentPlace = discoveryPlace(preview || placeId || "");
  const catalogDay = previewDay >= 0 ? draft.days[previewDay] : day;
  const catalogIndex = previewDay >= 0 ? previewDay : dayIndex;
  const found = filterDirectory({
    group: draft.group,
    category: draft.category,
    search: draft.search,
  });
  const page = Math.min(draft.page, Math.max(1, Math.ceil(found.length / 6)));
  const updateDay = (next: TripDay) =>
    change({
      ...draft,
      days: draft.days.map((d, i) => (i === dayIndex ? next : d)),
    });
  const closePreview = () => {
    setPreview(null);
    setPreviewDay(-1);
    setError("");
    closeIncoming?.();
  };
  const move = (activity: Activity, target: number) => {
    const chosen = draft.days[target];
    if (
      !chosen ||
      chosen.activities.length >= 30 ||
      ((activity.manual?.placeId || activity.catalogStopId) &&
        misplaced(activity, chosen))
    ) {
      setError("Choose a day with room at the place’s overnight base.");
      return;
    }
    change({
      ...draft,
      days: draft.days.map((d, i) =>
        i === target
          ? {
              ...d,
              activities: [
                ...d.activities,
                {
                  ...activity,
                  manual: {
                    ...activity.manual!,
                    base: chosen.transfer ? undefined : chosen.destination,
                  },
                },
              ],
            }
          : i === dayIndex
            ? {
                ...d,
                activities: d.activities.filter((a) => a.id !== activity.id),
              }
            : d,
      ),
    });
    setError("");
  };
  const warnings = manualDayWarnings(day, request);
  let previewActivity: Activity | undefined;
  if (currentPlace && catalogIndex < request.days) {
    try {
      previewActivity = catalogActivity(currentPlace.id, request, catalogDay);
    } catch {
      /* choose a compatible day in the preview */
    }
  }
  return (
    <div className="manual-board">
      <label>
        Itinerary day
        <select
          value={dayIndex}
          onChange={(e) => {
            change({ ...draft, selectedDay: Number(e.target.value) });
            setError("");
          }}
        >
          {draft.days.map((d, i) => (
            <option value={i} key={d.id}>
              Day {i + 1} · {destination(d.destination)?.name} · {d.date}
              {i >= request.days
                ? " · Outside trip"
                : d.transfer
                  ? " · Connection"
                  : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="manual-day">
        <h3>
          Day {dayIndex + 1} · {day.title}
        </h3>
        {dayIndex >= request.days && (
          <p className="notice">
            This day is outside your current duration. Move or remove its
            activities and time windows, or restore the day in The basics.
          </p>
        )}
        {!!warnings.length && (
          <div className="notice" role="status">
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p>Edit a time or move a stop if you want to adjust this day.</p>
          </div>
        )}
        {!day.activities.length && <p>This day is open.</p>}
        <ol className="manual-items">
          {day.activities.map((a, i) => (
            <li key={a.id} id={`activity-${a.id}`}>
              <div>
                <strong>{a.name}</strong>
                <p>
                  {isTimed(a) ? `${a.start}–${endTime(a)}` : "Flexible"} ·{" "}
                  {activityCostLabel(a)}
                  {a.locked ? " · Fixed" : ""}
                </p>
              </div>
              <div className="manual-item-actions">
                <button
                  className="text-link"
                  onClick={() => {
                    setEditor(a);
                    setSnapshotDay(dayIndex);
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-link"
                  disabled={i === 0}
                  aria-label={`Move ${a.name} up`}
                  onClick={() => {
                    const activities = [...day.activities];
                    [activities[i - 1], activities[i]] = [
                      activities[i],
                      activities[i - 1],
                    ];
                    updateDay({ ...day, activities });
                  }}
                >
                  ↑
                </button>
                <button
                  className="text-link"
                  disabled={i === day.activities.length - 1}
                  aria-label={`Move ${a.name} down`}
                  onClick={() => {
                    const activities = [...day.activities];
                    [activities[i + 1], activities[i]] = [
                      activities[i],
                      activities[i + 1],
                    ];
                    updateDay({ ...day, activities });
                  }}
                >
                  ↓
                </button>
                <label>
                  Move to day
                  <select
                    aria-label={`Move ${a.name} to day`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) move(a, Number(e.target.value));
                    }}
                  >
                    <option value="">Choose day</option>
                    {draft.days.slice(0, request.days).map(
                      (d, j) =>
                        j !== dayIndex && (
                          <option key={d.id} value={j}>
                            Day {j + 1} · {destination(d.destination)?.name}
                          </option>
                        ),
                    )}
                  </select>
                </label>
                <button className="text-link" onClick={() => setRemove(a)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        {error && !currentPlace && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {dayIndex < request.days && (
          <div className="trip-toolbar">
            {["Personal activity", "Meal", "Reservation", "Rest"].map(
              (kind) => (
                <button
                  key={kind}
                  className="button secondary small"
                  disabled={day.activities.length >= 30}
                  onClick={() => {
                    setSnapshotDay(dayIndex);
                    setEditor({
                      ...blankActivity(
                        "",
                        "09:00",
                        kind === "Meal" ? "Food" : kind,
                      ),
                      description: "",
                      locked: kind === "Reservation",
                      manual: {
                        ...manualDefaults,
                        base: day.transfer ? undefined : day.destination,
                      },
                    });
                  }}
                >
                  Add {kind.toLowerCase()}
                </button>
              ),
            )}
          </div>
        )}
      </div>
      <div className="manual-day">
        <h3>Time to leave open</h3>
        {day.activities.some((a) => !isTimed(a)) && (
          <p>
            Some stops have flexible times. Set a time window before asking for
            suggestions around them.
          </p>
        )}
        {dayWindows(day).map((gap) => (
          <div className="manual-window" key={gap.id}>
            <div>
              <strong>
                {gap.start}–{gap.end}
              </strong>{" "}
              ·{" "}
              {gap.intent === "free"
                ? "Keep free"
                : gap.intent === "open"
                  ? "Open to suggestions"
                  : "Unplanned"}
            </div>
            <button
              className="text-link"
              onClick={() =>
                setWindow(
                  day.windows?.some((w) => w.id === gap.id)
                    ? gap
                    : { ...gap, id: uid() },
                )
              }
            >
              Set intent
            </button>
            {day.windows?.some((w) => w.id === gap.id) && (
              <button
                className="text-link"
                onClick={() =>
                  updateDay({
                    ...day,
                    windows: day.windows?.filter((w) => w.id !== gap.id),
                  })
                }
              >
                Remove window
              </button>
            )}
            {gap.intent === "open" &&
              suggest &&
              dayIndex < request.days &&
              !day.transfer && (
                <button
                  className="button secondary small"
                  onClick={() => suggest({ dayId: day.id, windowId: gap.id })}
                >
                  Suggest a stop
                </button>
              )}
          </div>
        ))}
        {dayIndex < request.days && (
          <button
            className="button secondary small"
            disabled={(day.windows?.length ?? 0) >= 20}
            onClick={() =>
              setWindow({
                id: uid(),
                start: "10:00",
                end: "11:00",
                intent: "unplanned",
              })
            }
          >
            Add a time window
          </button>
        )}
      </div>
      <details className="manual-catalog" open>
        <summary>Browse places</summary>
        <div className="form-grid">
          <label>
            Search places
            <input
              type="search"
              value={draft.search}
              onChange={(e) =>
                change({ ...draft, search: e.target.value, page: 1 })
              }
            />
          </label>
          <label>
            Destination
            <select
              value={draft.group}
              onChange={(e) =>
                change({ ...draft, group: e.target.value, page: 1 })
              }
            >
              <option value="all">All destinations</option>
              {destinationGroups.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) =>
                change({ ...draft, category: e.target.value, page: 1 })
              }
            >
              <option value="all">All categories</option>
              {directoryCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <p role="status">{found.length} places</p>
        <div className="manual-catalog-results">
          {found.slice((page - 1) * 6, page * 6).map((p) => {
            const place = discoveryPlace(p.id)!;
            return (
              <CatalogPreview key={p.id} place={place} request={request}>
                <button
                  className="button secondary small"
                  onClick={() => {
                    setPreview(p.id);
                    setPreviewDay(dayIndex);
                    setError("");
                  }}
                >
                  Add to day…
                </button>
              </CatalogPreview>
            );
          })}
        </div>
        <div className="trip-toolbar">
          <button
            className="text-link"
            disabled={page <= 1}
            onClick={() => change({ ...draft, page: page - 1 })}
          >
            Previous places
          </button>
          <span>
            Page {page} of {Math.max(1, Math.ceil(found.length / 6))}
          </span>
          <button
            className="text-link"
            disabled={page * 6 >= found.length}
            onClick={() => change({ ...draft, page: page + 1 })}
          >
            Next places
          </button>
        </div>
      </details>
      {currentPlace && !editor && (
        <ConfirmDialog
          title={`Add ${currentPlace.name}?`}
          action="Set visit details"
          onClose={closePreview}
          onConfirm={() => {
            if (!previewActivity) {
              setError(
                "Choose a compatible day within your trip. You can change overnight bases in The basics.",
              );
              return;
            }
            if (
              draft.days.some((d) =>
                d.activities.some(
                  (a) =>
                    a.manual?.placeId === currentPlace.id ||
                    (previewActivity?.canonicalStopId &&
                      a.canonicalStopId === previewActivity.canonicalStopId),
                ),
              )
            ) {
              setError("This place is already on your itinerary.");
              return;
            }
            setSnapshotDay(catalogIndex);
            setEditor(previewActivity);
            closePreview();
          }}
        >
          <CatalogPreview place={currentPlace} request={request} />
          <label>
            Day for this visit
            <select
              value={catalogIndex}
              onChange={(e) => {
                setPreviewDay(Number(e.target.value));
                setError("");
              }}
            >
              {draft.days.slice(0, request.days).map((d, i) => (
                <option key={d.id} value={i}>
                  Day {i + 1} · {destination(d.destination)?.name}
                </option>
              ))}
            </select>
          </label>
          {!currentPlace.baseSlug && (
            <p className="fine-print">
              Travel from your base and visiting hours need confirmation.
            </p>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </ConfirmDialog>
      )}
      {editor && (
        <ActivityForm
          key={editor.id}
          initial={editor}
          onClose={() => setEditor(null)}
          onSave={(activity) => {
            const d = draft.days[snapshotDay];
            if (!d) throw new Error("Choose a day again.");
            const original = d.activities.find((a) => a.id === activity.id);
            const exists = !!original;
            if (!exists && d.activities.length >= 30)
              throw new Error(
                "This day is full. Move a stop or choose another day.",
              );
            if (
              !exists &&
              isTimed(activity) &&
              d.windows?.some(
                (w) =>
                  w.intent === "free" &&
                  activity.start < w.end &&
                  endTime(activity) > w.start,
              )
            )
              throw new Error(
                "That time is marked Keep free. Choose another time or edit the window.",
              );
            const updated = {
              ...activity,
              manual: {
                ...activity.manual!,
                reviewedDate:
                  (original?.locked && original.manual?.reviewedDate) || d.date,
              },
            };
            change({
              ...draft,
              selectedDay: snapshotDay,
              days: draft.days.map((row, i) =>
                i === snapshotDay
                  ? {
                      ...d,
                      activities: exists
                        ? d.activities.map((a) =>
                            a.id === activity.id ? updated : a,
                          )
                        : [...d.activities, updated],
                    }
                  : row,
              ),
            });
            setEditor(null);
          }}
        />
      )}
      {window && (
        <WindowForm
          initial={window}
          cancel={() => setWindow(null)}
          save={(value) => {
            if (
              (day.windows?.length ?? 0) >= 20 &&
              !day.windows?.some((w) => w.id === value.id)
            )
              throw new Error(
                "This day already has 20 time windows. Edit or remove an existing window first.",
              );
            if (
              day.windows?.some(
                (w) =>
                  w.id !== value.id &&
                  w.start < value.end &&
                  w.end > value.start,
              )
            )
              throw new Error(
                "Choose a window that does not overlap another saved window.",
              );
            updateDay({
              ...day,
              windows: [
                ...(day.windows ?? []).filter((w) => w.id !== value.id),
                value,
              ],
            });
            setWindow(null);
          }}
        />
      )}
      {remove && (
        <ConfirmDialog
          title={`Remove ${remove.name}?`}
          action="Remove activity"
          onClose={() => setRemove(null)}
          onConfirm={() => {
            updateDay({
              ...day,
              activities: day.activities.filter((a) => a.id !== remove.id),
            });
            setRemove(null);
          }}
        >
          <p>Remove this activity from Day {dayIndex + 1}.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

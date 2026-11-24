"use client";
import { useEffect, useRef, useState } from "react";
import { destination, peso } from "@/lib/destinations";
import { discoveryPlace, discoveryPlaces } from "@/lib/discovery";
import { clock, minutes } from "@/lib/engine";
import {
  acceptManualSuggestions,
  assistanceWindows,
  suggestionsForWindow,
  type ManualDraft,
  type Suggestion,
} from "@/lib/manual-planning";
import type { Activity, TripRequest } from "@/lib/trip";
import { CatalogPreview, type GapTarget } from "./manual-itinerary";

type Props = {
  request: TripRequest;
  draft: ManualDraft;
  change: (draft: ManualDraft) => void;
  direct?: GapTarget | null;
  editItinerary: () => void;
};
type Options = {
  key: string;
  day: string;
  time: string;
  choices: Suggestion[];
};
const targetKey = (target: GapTarget) => `${target.dayId}:${target.windowId}`;
const snapshot = (request: TripRequest, draft: ManualDraft) =>
  JSON.stringify([request, draft.days, draft.budget]);

export default function ManualSuggestions({
  request,
  draft,
  change,
  direct,
  editItinerary,
}: Props) {
  const [targets, setTargets] = useState<string[]>([]),
    [options, setOptions] = useState<Options[]>([]);
  const [selected, setSelected] = useState<Record<string, Suggestion>>({});
  const [revision, setRevision] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [undo, setUndo] = useState<Activity[]>([]);
  const activeRequest = useRef<AbortController | null>(null);
  const current = snapshot(request, draft);
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  }, [current]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const rows = draft.days.slice(0, request.days).flatMap((day, index) =>
    day.transfer
      ? []
      : assistanceWindows(day)
          .filter((window) => window.intent !== "free")
          .map((window) => ({
            day,
            dayName: `Day ${index + 1} · ${day.title}${window.id.startsWith("open-day-") ? " · Open day" : ""}`,
            window,
            key: targetKey({ dayId: day.id, windowId: window.id }),
          })),
  );
  const selectedTargets = direct ? [targetKey(direct)] : targets;
  const stale = !!options.length && revision !== current;
  async function requestChoices() {
    const work = rows.filter((row) => selectedTargets.includes(row.key));
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setBusy(true);
    setMessage("");
    setOptions([]);
    setSelected({});
    let assisted = false,
      failed = false;
    try {
      const result: Options[] = [];
      // Run sequentially and cap each explicit batch to avoid bursts.
      for (const row of work) {
        if (controller.signal.aborted) return;
        const options = suggestionsForWindow(
          request,
          draft.days,
          row.day,
          row.window.id,
          draft.budget,
        );
        let choices = options;
        if (options.length) {
          try {
            const response = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(15000),
              ]),
              body: JSON.stringify({
                action: "rank-stops",
                slug: row.day.destination,
                ids: options.map((o) => o.stopId),
                interests: request.interests,
                pace: request.pace,
                categories: request.activityCategories,
              }),
            });
            if (!response.ok) throw new Error("Ranking unavailable");
            const data = (await response.json()) as {
              ids?: unknown;
              assisted?: boolean;
            };
            if (
              !Array.isArray(data.ids) ||
              !data.ids.length ||
              new Set(data.ids).size !== data.ids.length ||
              data.ids.some((id) => !options.some((o) => o.stopId === id))
            )
              throw new Error("Invalid ranking");
            choices = data.ids.map(
              (id) => options.find((option) => option.stopId === id)!,
            );
            assisted ||= data.assisted === true;
          } catch {
            if (controller.signal.aborted) return;
            failed = true;
          }
        }
        result.push({
          key: row.key,
          day: row.dayName,
          time: `${row.window.start}–${row.window.end}`,
          choices: choices.slice(0, 3),
        });
      }
      if (controller.signal.aborted) return;
      if (latest.current !== current) {
        setMessage(
          "Your itinerary changed while suggestions were loading. Request fresh options.",
        );
        return;
      }
      setOptions(result);
      setRevision(current);
      setMessage(
        failed
          ? "AI ranking was unavailable. These catalog options passed Lakbay’s timing checks."
          : assisted
            ? "AI ranked the eligible catalog options. Choose what you want to add."
            : "Options are based on Lakbay’s catalog and your selected time windows.",
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (!direct) return;
    const timer = setTimeout(() => {
      void requestChoices();
    }, 0);
    return () => clearTimeout(timer);
    // Mounting this dialog follows an explicit request for this specific gap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direct]);
  function apply(picks: Suggestion[]) {
    if (stale) {
      setMessage(
        "Your itinerary changed. Request fresh options before applying.",
      );
      return;
    }
    try {
      const applied = acceptManualSuggestions(
        request,
        draft.days,
        draft.budget,
        picks,
      );
      const next = { ...draft, days: applied.days };
      const used = new Set(picks.map(targetKey));
      const remaining = options
        .filter((group) => !used.has(group.key))
        .map((group) => {
          const first = group.choices[0];
          const day = applied.days.find((day) => day.id === first?.dayId);
          const valid = day
            ? suggestionsForWindow(
                request,
                applied.days,
                day,
                first.windowId,
                draft.budget,
              )
            : [];
          return {
            ...group,
            choices: group.choices.flatMap((choice) =>
              valid.filter((candidate) => candidate.stopId === choice.stopId),
            ),
          };
        });
      change(next);
      setUndo(applied.added);
      setOptions(remaining);
      setSelected({});
      setRevision(snapshot(request, next));
      setMessage(
        `Added ${applied.added.length} ${applied.added.length === 1 ? "stop" : "stops"}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "These additions no longer fit together.",
      );
    }
  }
  const canUndo =
    undo.length > 0 &&
    undo.every((item) =>
      draft.days.some((day) =>
        day.activities.some((a) => JSON.stringify(a) === JSON.stringify(item)),
      ),
    );
  return (
    <section className="manual-help" aria-label="Trip suggestions">
      {!direct && (
        <>
          <h3>Help complete selected days</h3>
          <p>
            Choose up to three days or time windows. Each option adds at most
            one stop.
          </p>
          {!rows.length && (
            <button className="button secondary small" onClick={editItinerary}>
              Set a time window
            </button>
          )}
          <div className="manual-gap-options">
            {rows.map((row) => (
              <label className="check-label" key={row.key}>
                <input
                  type="checkbox"
                  checked={targets.includes(row.key)}
                  disabled={
                    busy || (targets.length >= 3 && !targets.includes(row.key))
                  }
                  onChange={(e) =>
                    setTargets(
                      e.target.checked
                        ? [...targets, row.key]
                        : targets.filter((key) => key !== row.key),
                    )
                  }
                />
                {row.dayName} · {row.window.start}–{row.window.end}
              </label>
            ))}
          </div>
        </>
      )}
      <button
        className="button secondary"
        disabled={
          busy || !rows.some((row) => selectedTargets.includes(row.key))
        }
        onClick={requestChoices}
      >
        {busy
          ? "Checking your time windows…"
          : direct
            ? "Refresh options"
            : "Suggest additions"}
      </button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {stale && (
        <p className="notice">
          Your plan changed. Request fresh options before applying.
        </p>
      )}
      {options.map((group) => (
        <fieldset key={group.key} className="manual-suggestion-group">
          <legend>
            {group.day} · {group.time}
          </legend>
          {!group.choices.length && (
            <p>
              No stop fits comfortably with the available timing, route
              information, preferences and budget. Keep this time open, or
              review its timing in Your itinerary.
            </p>
          )}
          {group.choices.map((pick) => {
            const day = draft.days.find((day) => day.id === pick.dayId);
            const stop = destination(day?.destination ?? null)?.stops.find(
              (s) => s.id === pick.stopId,
            );
            const place =
              discoveryPlaces.find((p) => p.stopId === pick.stopId) ??
              discoveryPlace(pick.stopId);
            if (!stop || !place) return null;
            return (
              <CatalogPreview key={pick.stopId} place={place} request={request}>
                <div className="manual-fit">
                  <strong>
                    {pick.start}–{clock(minutes(pick.start) + pick.duration)} ·{" "}
                    {pick.duration} min visit
                  </strong>
                  <p>
                    {pick.before} min before and {pick.after} min after for
                    travel, with {pick.spare} min to spare. Transfers are
                    planning allowances.{" "}
                    {stop.openingHours
                      ? "Fits recorded regular hours. Check current hours."
                      : "Opening hours are unknown."}
                  </p>
                  <p>
                    {peso(pick.cost)} estimated added group cost, including{" "}
                    {peso(pick.transport)} for local transport.{" "}
                    {pick.entryUnknown
                      ? "Entry price unknown. Any catalog allowance is provisional."
                      : "Confirm transport fares and entry prices."}
                  </p>
                  <label className="check-label">
                    <input
                      type="radio"
                      disabled={stale}
                      name={`choice-${group.key}`}
                      checked={selected[group.key]?.stopId === pick.stopId}
                      onChange={() =>
                        setSelected({ ...selected, [group.key]: pick })
                      }
                    />{" "}
                    Include {stop.name}
                  </label>
                  <button
                    className="button secondary small"
                    disabled={stale}
                    onClick={() => apply([pick])}
                  >
                    Accept this stop
                  </button>
                  <button
                    className="text-link"
                    onClick={() => {
                      setOptions(
                        options.map((item) =>
                          item === group
                            ? {
                                ...item,
                                choices: item.choices.filter(
                                  (choice) => choice !== pick,
                                ),
                              }
                            : item,
                        ),
                      );
                      if (selected[group.key] === pick)
                        setSelected(
                          Object.fromEntries(
                            Object.entries(selected).filter(
                              ([key]) => key !== group.key,
                            ),
                          ),
                        );
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </CatalogPreview>
            );
          })}
          {!!group.choices.length && (
            <button
              className="text-link"
              onClick={() => {
                setOptions(options.filter((item) => item !== group));
                setSelected(
                  Object.fromEntries(
                    Object.entries(selected).filter(
                      ([key]) => key !== group.key,
                    ),
                  ),
                );
              }}
            >
              Keep this time open
            </button>
          )}
        </fieldset>
      ))}
      {!!Object.keys(selected).length && (
        <button
          className="button"
          disabled={stale}
          onClick={() => apply(Object.values(selected))}
        >
          Apply selected additions
        </button>
      )}
      {canUndo && (
        <button
          className="button secondary small"
          onClick={() => {
            const ids = new Set(undo.map((item) => item.id));
            change({
              ...draft,
              days: draft.days.map((day) => ({
                ...day,
                activities: day.activities.filter((item) => !ids.has(item.id)),
              })),
            });
            setUndo([]);
            setMessage("Undid the last additions.");
          }}
        >
          Undo additions
        </button>
      )}
    </section>
  );
}

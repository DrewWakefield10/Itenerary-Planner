"use client";
import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import {
  activitySchema,
  expenseCategories,
  type Activity,
  type TripRequest,
} from "@/lib/trip";
import { destination } from "@/lib/destinations";
import { fromStop } from "@/lib/engine";
import { updateActivityField } from "@/lib/activity-sources";
import { disruptionSensitivitySchema } from "@/lib/disruptions";
export default function ActivityEditor({
  activity,
  slug,
  request,
  onSave,
  onClose,
}: {
  activity: Activity;
  slug: string;
  request: TripRequest;
  onSave: (a: Activity) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [a, setA] = useState(activity);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function field<K extends keyof Activity>(key: K, value: Activity[K]) {
    setA(updateActivityField(a, key, value));
  }
  return (
    <dialog ref={dialog} className="editor-dialog" onCancel={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = activitySchema.safeParse({
            ...a,
            provenance: "user",
            source: "Edited by traveler",
          });
          if (!parsed.success) {
            setError(
              parsed.error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join(" "),
            );
            return;
          }
          if ((a.lat === null) !== (a.lng === null)) {
            setError("Provide both coordinates or leave both blank.");
            return;
          }
          onSave(parsed.data);
        }}
      >
        <div className="modal-heading">
          <span className="eyebrow">A LITTLE DETOUR</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close activity editor"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <h2>
          Make this stop <em>yours.</em>
        </h2>
        <label>
          Replace with a destination stop
          <select
            value=""
            onChange={(e) => {
              const stop = destination(slug)?.stops.find(
                (s) => s.name === e.target.value,
              );
              if (stop) setA({ ...fromStop(stop, request, a.start), id: a.id });
            }}
          >
            <option value="">Keep current stop / choose an alternative</option>
            {destination(slug)?.stops.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Activity name
          <input
            autoFocus
            required
            maxLength={160}
            value={a.name}
            onChange={(e) => field("name", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Start time
            <input
              type="time"
              required
              value={a.start}
              onChange={(e) => field("start", e.target.value)}
            />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              required
              min={15}
              max={720}
              step={15}
              value={a.duration}
              onChange={(e) => field("duration", Number(e.target.value))}
            />
          </label>
          <label>
            Estimated cost for whole group (₱)
            <input
              type="number"
              required
              min={0}
              max={10000000}
              step={1}
              value={a.cost}
              onChange={(e) => field("cost", Number(e.target.value))}
            />
          </label>
          <label>
            Budget category
            <select
              value={a.category}
              onChange={(e) =>
                field("category", e.target.value as Activity["category"])
              }
            >
              {expenseCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Notes & description
          <textarea
            maxLength={1500}
            value={a.description}
            onChange={(e) => field("description", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Latitude (optional)
            <input
              type="number"
              min={-90}
              max={90}
              step="any"
              value={a.lat ?? ""}
              onChange={(e) =>
                field(
                  "lat",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Longitude (optional)
            <input
              type="number"
              min={-180}
              max={180}
              step="any"
              value={a.lng ?? ""}
              onChange={(e) =>
                field(
                  "lng",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
        </div>
        <label>
          Transport / transfer information
          <input
            maxLength={600}
            value={a.transport}
            onChange={(e) => field("transport", e.target.value)}
          />
        </label>
        <label>
          Accessibility notes
          <textarea
            maxLength={1000}
            value={a.accessibility}
            onChange={(e) => field("accessibility", e.target.value)}
          />
        </label>
        <label>
          Booking notes
          <input
            maxLength={600}
            value={a.booking}
            onChange={(e) => field("booking", e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={a.outdoor}
            onChange={(e) => field("outdoor", e.target.checked)}
          />
          Outdoor activity
        </label>
        <fieldset className="sensitivity-fields">
          <legend>Weather sensitivities (optional)</legend>
          {disruptionSensitivitySchema.options.map((tag) => (
            <label className="check-label" key={tag}>
              <input
                type="checkbox"
                checked={a.disruptionSensitivities.includes(tag)}
                onChange={(e) =>
                  field(
                    "disruptionSensitivities",
                    e.target.checked
                      ? [...a.disruptionSensitivities, tag]
                      : a.disruptionSensitivities.filter((t) => t !== tag),
                  )
                }
              />
              {tag === "heavy-rain"
                ? "Rain-sensitive"
                : tag === "marine-conditions"
                  ? "Marine conditions (tag only)"
                  : "Heat (tag only)"}
            </label>
          ))}
        </fieldset>
        <label className="check-label">
          <input
            type="checkbox"
            checked={a.locked}
            onChange={(e) => field("locked", e.target.checked)}
          />
          Lock this activity’s time and details
        </label>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="planner-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button">
            Save activity <Check size={17} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

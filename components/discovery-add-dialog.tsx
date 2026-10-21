"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { discoveryPlace } from "@/lib/discovery";
import { readTrips, saveTrip } from "@/lib/trip-storage";
import {
  previewDiscoveryAddition,
  acceptDiscoveryAddition,
  suggestedDiscoveryTime,
  type DiscoveryAddition,
} from "@/lib/discovery-planning";
import { endTime } from "@/lib/engine";
import { peso, destination } from "@/lib/destinations";
import type { Trip } from "@/lib/trip";
import { SourceIndicator } from "./source-indicator";

export default function DiscoveryAddDialog({
  placeId,
  onClose,
}: {
  placeId: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [trips, setTrips] = useState<Trip[]>([]),
    [tripId, setTripId] = useState("");
  const [dayIndex, setDayIndex] = useState(0),
    [start, setStart] = useState("09:00");
  const [preview, setPreview] = useState<DiscoveryAddition | null>(null),
    [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const place = discoveryPlace(placeId)!;
  useEffect(() => {
    dialog.current?.showModal();
    const eligible = readTrips().filter((t) =>
      t.days.some((d) => d.destination === place.baseSlug && !d.transfer),
    );
    setTrips(eligible);
    if (eligible[0]) chooseTrip(eligible[0]);
    // The dialog is remounted for each selected place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function chooseDay(trip: Trip, index: number) {
    setDayIndex(index);
    setStart(suggestedDiscoveryTime(trip, index, placeId) || "09:00");
    setPreview(null);
    setError("");
  }
  function chooseTrip(trip: Trip) {
    setTripId(trip.id);
    chooseDay(
      trip,
      trip.days.findIndex(
        (d) => d.destination === place.baseSlug && !d.transfer,
      ),
    );
  }
  const trip = trips.find((t) => t.id === tripId);
  return (
    <dialog
      ref={dialog}
      className="editor-dialog discovery-add-dialog"
      aria-labelledby="discovery-add-title"
      onCancel={onClose}
    >
      <div className="modal-heading">
        <span className="eyebrow">A PLACE FOR YOUR JOURNAL</span>
        <button
          className="icon-button"
          aria-label="Close discovery addition"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <h2 id="discovery-add-title">
        Add <em>{place.name}.</em>
      </h2>
      {savedId ? (
        <div role="status">
          <p>
            Added to your trip. Existing activities and overnight bases were
            preserved.
          </p>
          <Link className="button" href={`/trips/${savedId}`}>
            Open your updated trip
          </Link>
        </div>
      ) : (
        <>
          <p>
            Choose an ordinary day in {destination(place.baseSlug)?.name}.
            Preview the time and group allowance before accepting.
          </p>
          {!trips.length ? (
            <div className="paper-note">
              <p>
                No saved trip has an eligible day at this exact base. Legacy
                “Palawan” days are ambiguous and are not automatically treated
                as El Nido.
              </p>
              <Link
                className="button"
                href={`/planner?destinations=${place.baseSlug}`}
              >
                Plan a trip here
              </Link>
            </div>
          ) : (
            <>
              <label>
                Choose saved trip
                <select
                  value={tripId}
                  onChange={(e) =>
                    chooseTrip(trips.find((t) => t.id === e.target.value)!)
                  }
                >
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Choose itinerary day
                  <select
                    value={dayIndex}
                    onChange={(e) =>
                      trip && chooseDay(trip, Number(e.target.value))
                    }
                  >
                    {trip?.days.map(
                      (d, i) =>
                        d.destination === place.baseSlug &&
                        !d.transfer && (
                          <option key={d.id} value={i}>
                            Day {i + 1} · {d.date}
                          </option>
                        ),
                    )}
                  </select>
                </label>
                <label>
                  Visit start time
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      setPreview(null);
                      setError("");
                    }}
                  />
                </label>
              </div>
              {trip && (
                <details className="discovery-day-schedule">
                  <summary>
                    Current day schedule (
                    {trip.days[dayIndex]?.activities.length || 0} activities)
                  </summary>
                  <ul>
                    {trip.days[dayIndex]?.activities.map((a) => (
                      <li key={a.id}>
                        {a.start}–{endTime(a)} · {a.name}
                        {a.locked ? " · Locked" : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="fine-print">
                A proposed visit needs an empty slot and 45-minute planning
                buffers. Actual local travel time is unverified. If it does not
                fit, edit the day in your trip first.
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  try {
                    const current = readTrips().find((t) => t.id === tripId);
                    if (!current)
                      throw new Error("This trip is no longer available.");
                    setPreview(
                      previewDiscoveryAddition(
                        current,
                        dayIndex,
                        placeId,
                        start,
                      ),
                    );
                    setError("");
                  } catch (e) {
                    setPreview(null);
                    setError(
                      e instanceof Error ? e.message : "Preview unavailable.",
                    );
                  }
                }}
              >
                Preview addition
              </button>
              {preview && (
                <section
                  className="paper-note discovery-add-preview"
                  aria-label="Addition preview"
                >
                  <h3>{preview.activity.name}</h3>
                  <p>
                    Day {dayIndex + 1} · {preview.start}–
                    {endTime(preview.activity)} · {preview.activity.duration}{" "}
                    minutes
                  </p>
                  <p>
                    Additional group allowance: {peso(preview.activity.cost)}{" "}
                    <SourceIndicator
                      source={preview.activity.sources.price}
                      label="Price"
                    />
                    . This is not a quoted fee; a zero allowance does not mean
                    free entry.
                  </p>
                  <p>{preview.activity.booking} <SourceIndicator source={preview.activity.sources.booking} label="Booking" /></p>
                  <p>{preview.activity.transport} <SourceIndicator source={preview.activity.sources.transport} label="Transport" /></p>
                  {preview.activity.entryPrice&&<p>Entry price: {preview.activity.entryPrice.amount===null?"Unknown; confirm with the venue.":`${peso(preview.activity.entryPrice.amount)} per ${preview.activity.entryPrice.basis}`} <SourceIndicator source={preview.activity.entryPrice.source} label="Entry price" /></p>}
                  <p>
                    {preview.activity.openingHours
                      ? "This fits the recorded regular opening hours. Check special closures and reservations."
                      : "Opening hours are unverified. Confirm the venue is open at the proposed time."}
                  </p>
                  <SourceIndicator
                    source={preview.activity.sources.description}
                    label="Place description"
                  />
                  {preview.warnings.length > 0 && (
                    <ul>
                      {preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <p>
                    All {trip?.days[dayIndex].activities.length} existing
                    activities stay at their current times.
                  </p>
                  <div className="discovery-actions">
                    <button
                      className="button"
                      onClick={() => {
                        try {
                          const current = readTrips().find(
                            (t) => t.id === tripId,
                          );
                          if (!current)
                            throw new Error(
                              "This trip is no longer available.",
                            );
                          const next = acceptDiscoveryAddition(
                            current,
                            preview,
                          );
                          if (!saveTrip(next))
                            throw new Error(
                              "Could not save. The existing trip is preserved.",
                            );
                          setSavedId(next.id);
                          setPreview(null);
                        } catch (e) {
                          setPreview(null);
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Could not apply addition.",
                          );
                        }
                      }}
                    >
                      Confirm & add
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setPreview(null)}
                    >
                      Keep itinerary unchanged
                    </button>
                  </div>
                </section>
              )}
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
            </>
          )}
        </>
      )}
    </dialog>
  );
}

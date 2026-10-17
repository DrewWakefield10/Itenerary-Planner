"use client";
import { useState } from "react";
import type { Trip } from "@/lib/trip";
import type { Forecast } from "@/lib/weather";
import { assessRainForecast } from "@/lib/weather";
import {
  affectedRainActivities,
  type RainAlternative,
} from "@/lib/rain-planning";

export default function RainSuggestions({
  trip,
  dayIndex,
  forecast,
  now,
  onPreview,
}: {
  trip: Trip;
  dayIndex: number;
  forecast: Forecast | null;
  now: number;
  onPreview?: (suggestion: RainAlternative) => void;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const day = trip.days[dayIndex];
  const signal = assessRainForecast(forecast, day.date, now);
  if (!forecast) return null;
  if (!signal.usable)
    return (
      <p className="weather-availability" role="status">
        {signal.message} No weather-based changes have been proposed.
      </p>
    );
  if (!signal.attention)
    return <p className="weather-availability">{signal.message}</p>;
  const affected = affectedRainActivities(trip, dayIndex);
  const visible = affected.filter(
    (item) => !dismissed.includes(item.activity.id),
  );
  return (
    <section
      className="rain-suggestions"
      aria-label="Rain planning suggestions"
    >
      <h4>Leave a little room for rain.</h4>
      <p>{signal.message}</p>
      {!affected.length && (
        <p>
          No activities on this day have a recorded rain sensitivity. Tags may
          be missing on older trips; this does not establish that activities are
          unaffected.
        </p>
      )}
      {visible.map((item) => (
        <div className="rain-suggestion" key={item.activity.id}>
          <strong>{item.activity.name}</strong>
          <p>{item.reason}</p>
          {item.alternative ? (
            <>
              <p>
                Consider {item.alternative.replacement.name}. Check the
                schedule, cost, and venue details in the preview.
              </p>
              {onPreview && (
                <div className="rain-suggestion-actions">
                  <button
                    className="button secondary small"
                    onClick={() => onPreview(item.alternative!)}
                    aria-label={`Preview rain alternative for ${item.activity.name}`}
                  >
                    Preview rain alternative
                  </button>
                  <button
                    className="text-link plain-button"
                    onClick={() =>
                      setDismissed([...dismissed, item.activity.id])
                    }
                    aria-label={`Dismiss rain suggestion for ${item.activity.name}`}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="fine-print">{item.unavailableReason}</p>
          )}
        </div>
      ))}
      {affected.length > 0 && !visible.length && (
        <p>
          Rain suggestions dismissed for this view. Your itinerary is unchanged.
        </p>
      )}
      <small>
        Nothing changes until you explicitly confirm a preview. Official
        advisories are linked below for your review; no live advisory feed is
        connected.
      </small>
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { CloudSun } from "lucide-react";
import { forecastResponseSchema, type Forecast } from "@/lib/weather";
import type { Trip } from "@/lib/trip";
import type { RainAlternative } from "@/lib/rain-planning";
import RainSuggestions from "./rain-suggestions";
import { officialAdvisories } from "@/lib/destinations";
import { AdvisorySources } from "./source-indicator";
export default function WeatherPanel({
  slug,
  date,
  trip,
  dayIndex,
  onPreview,
}: {
  slug: string;
  date: string;
  trip?: Trip;
  dayIndex?: number;
  onPreview?: (suggestion: RainAlternative) => void;
}) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch(`/api/weather?destination=${encodeURIComponent(slug)}&date=${date}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Weather request failed");
        return forecastResponseSchema.parse(await r.json());
      })
      .then((value) => {
        if (active) {
          setForecast(value);
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (active)
          setForecast({
            available: false,
            message: "Weather unavailable. Check PAGASA for advisories.",
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [slug, date, refresh]);
  return (
    <div className="weather-panel">
      <CloudSun size={23} />
      <div>
        <strong>
          {forecast?.available
            ? forecast.condition||'Forecast available'
            : "A little weather awareness"}
        </strong>
        {!forecast ? (
          <p>Checking forecast availability…</p>
        ) : forecast.available ? (
          <>
            <p>
              {forecast.date || date} · High {forecast.temperature ?? "—"}°C ·
              Rain chance {forecast.rain ?? "—"}%
            </p>
            <small>
              Retrieved{" "}
              {forecast.retrievedAt &&
              !Number.isNaN(Date.parse(forecast.retrievedAt))
                ? new Date(forecast.retrievedAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })
                : "Unknown"}{" "}
              PHT ·{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open-Meteo
              </a>
            </small>
          </>
        ) : (
          <p>{forecast.message}</p>
        )}
        <button
          type="button"
          className="text-link plain-button weather-refresh"
          disabled={!forecast}
          onClick={() => {
            setForecast(null);
            setRefresh(refresh + 1);
          }}
        >
          Refresh forecast
        </button>
        {trip && dayIndex !== undefined && (
          <RainSuggestions
            key={`${trip.days[dayIndex].id}:${refresh}:${forecast?.retrievedAt || ""}`}
            trip={trip}
            dayIndex={dayIndex}
            forecast={forecast}
            now={now}
            onPreview={onPreview}
          />
        )}
        <AdvisorySources links={officialAdvisories} />
        {forecast?.available && (
          <small>Forecasts do not establish outdoor or marine safety.</small>
        )}
      </div>
    </div>
  );
}

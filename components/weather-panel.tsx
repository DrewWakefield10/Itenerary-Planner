"use client";
import { useEffect, useState } from "react";
import { CloudSun } from "lucide-react";
import type { Forecast } from "@/lib/weather";
import { officialAdvisories } from "@/lib/destinations";
import { AdvisorySources } from "./source-indicator";
export default function WeatherPanel({
  slug,
  date,
}: {
  slug: string;
  date: string;
}) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/weather?destination=${encodeURIComponent(slug)}&date=${date}`, {
      signal: controller.signal,
    })
      .then((r) => r.json() as Promise<Forecast>)
      .then(setForecast)
      .catch((e) => {
        if (e.name !== "AbortError")
          setForecast({
            available: false,
            message: "Weather unavailable. Check PAGASA for advisories.",
          });
      });
    return () => controller.abort();
  }, [slug, date]);
  return (
    <div className="weather-panel">
      <CloudSun size={23} />
      <div>
        <strong>
          {forecast?.available
            ? forecast.condition
            : "A little weather awareness"}
        </strong>
        {!forecast ? (
          <p>Checking forecast availability…</p>
        ) : forecast.available ? (
          <>
            <p>
              {forecast.date} · High {forecast.temperature ?? "—"}°C · Rain
              chance {forecast.rain ?? "—"}%
            </p>
            <small>
              Retrieved{" "}
              {new Date(forecast.retrievedAt!).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}{" "}
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
        <AdvisorySources links={officialAdvisories}/>
        {forecast?.available && (
          <small>Forecasts do not establish outdoor or marine safety.</small>
        )}
      </div>
    </div>
  );
}

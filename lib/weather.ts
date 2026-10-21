import { z } from "zod/v3";
export const weatherSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(
      z.number().min(0).max(100).nullable(),
    ),
    weather_code: z.array(z.number().int().min(0).max(99).nullable()),
  }),
});
export const forecastResponseSchema = z.object({
  available: z.boolean(),
  message: z.string().optional(),
  date: z.string().optional(),
  temperature: z.number().nullable().optional(),
  rain: z.number().min(0).max(100).nullable().optional(),
  weatherCode: z.number().int().min(0).max(99).nullable().optional(),
  condition: z.string().optional(),
  retrievedAt: z.string().optional(),
});
export type Forecast = z.infer<typeof forecastResponseSchema>;
export function condition(code: number | null) {
  if (code === null) return "Conditions unavailable";
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy / overcast";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Drizzle or rain";
  if (code <= 77) return "Wintry precipitation";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Variable conditions";
}

export const FORECAST_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const rainCodes = new Set([63, 65, 67, 81, 82, 95, 96, 99]);
export type RainSignal = {
  attention: boolean;
  usable: boolean;
  message: string;
};
export function assessRainForecast(
  forecast: Forecast | null,
  date: string,
  now = Date.now(),
): RainSignal {
  if (!forecast)
    return {
      attention: false,
      usable: false,
      message: "Checking forecast availability…",
    };
  if (!forecast.available)
    return {
      attention: false,
      usable: false,
      message:
        forecast.message ||
        "Forecast unavailable. Missing data does not establish favorable conditions.",
    };
  if (forecast.date !== date)
    return {
      attention: false,
      usable: false,
      message:
        "Forecast date does not match this day. Refresh before using weather suggestions.",
    };
  const retrieved = Date.parse(forecast.retrievedAt || "");
  if (!Number.isFinite(retrieved) || retrieved > now + 5 * 60 * 1000)
    return {
      attention: false,
      usable: false,
      message:
        "Forecast freshness cannot be established. Refresh before using weather suggestions.",
    };
  if (now - retrieved > FORECAST_MAX_AGE_MS)
    return {
      attention: false,
      usable: false,
      message:
        "This forecast was retrieved over six hours ago. Refresh for current planning signals; no alternatives are being inferred from old data.",
    };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  if (date < today)
    return {
      attention: false,
      usable: false,
      message:
        "This day is in the past. This forecast is not a current planning signal.",
    };
  if (forecast.rain == null && forecast.weatherCode == null)
    return {
      attention: false,
      usable: false,
      message:
        "Rain information is missing. Conditions have not been assumed favorable.",
    };
  const attention =
    (forecast.rain ?? -1) >= 70 || rainCodes.has(forecast.weatherCode ?? -1);
  return {
    attention,
    usable: true,
    message: attention
      ? `${forecast.rain != null ? `${forecast.rain}% daily rain probability. ` : ""}${rainCodes.has(forecast.weatherCode ?? -1) ? "The daily forecast also indicates rain showers, rain, or thunderstorms. " : ""}Rain may disrupt sensitive outdoor plans. This is a planning signal, not a safety determination or a prediction for the exact activity time.`
      : "The available daily forecast does not meet the rain-suggestion threshold. This is not an assurance of favorable conditions or safety.",
  };
}

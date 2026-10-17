import { destination } from "@/lib/destinations";
import { weatherSchema, condition, type Forecast } from "@/lib/weather";
const cache = new Map<string, { expires: number; forecast: Forecast }>();
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const d = destination(q.get("destination") || "");
  const date = q.get("date") || "";
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json(
      { available: false, message: "Invalid destination or date." },
      { status: 400 },
    );
  if (process.env.WEATHER_ENABLED !== "true")
    return Response.json({
      available: false,
      message:
        "Live forecasts are not enabled. Check PAGASA and local advisories.",
    });
  const key = d.slug + date,
    now = Date.now();
  const saved = cache.get(key);
  if (saved && saved.expires > now) return Response.json(saved.forecast);
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const url = new URL(
      apiKey
        ? "https://customer-api.open-meteo.com/v1/forecast"
        : "https://api.open-meteo.com/v1/forecast",
    );
    url.search = new URLSearchParams({
      latitude: String(d.lat),
      longitude: String(d.lng),
      daily: "temperature_2m_max,precipitation_probability_max,weather_code",
      timezone: "Asia/Manila",
      forecast_days: "16",
      ...(apiKey ? { apikey: apiKey } : {}),
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Forecast service unavailable");
    const data = weatherSchema.parse(await response.json());
    const i = data.daily.time.indexOf(date);
    const forecast: Forecast =
      i === -1
        ? {
            available: false,
            message:
              "This date is outside the available forecast window. Check closer to departure.",
          }
        : {
            available: true,
            date,
            temperature: data.daily.temperature_2m_max[i] ?? null,
            rain: data.daily.precipitation_probability_max[i] ?? null,
            condition: condition(data.daily.weather_code[i] ?? null),
            weatherCode: data.daily.weather_code[i] ?? null,
            retrievedAt: new Date().toISOString(),
          };
    if (cache.size > 200) cache.clear();
    cache.set(key, { expires: now + 1800000, forecast });
    return Response.json(forecast);
  } catch {
    return Response.json({
      available: false,
      message:
        "Forecast unavailable right now. Check official advisories; no weather data has been assumed.",
    });
  }
}

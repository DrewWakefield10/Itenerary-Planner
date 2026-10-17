import { requestSchema } from "@/lib/trip";
import { createProvider } from "@/lib/provider";
const recent = new Map<string, number[]>();
export async function GET() {
  return Response.json({ mode: process.env.AI_API_KEY ? "ai" : "demo" });
}
export async function POST(req: Request) {
  try {
    if (
      req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin
    )
      return Response.json({ error: "Origin not allowed" }, { status: 403 });
    const text = await req.text();
    if (text.length > 18000)
      return Response.json({ error: "Request is too large." }, { status: 413 });
    const body = JSON.parse(text);
    const parsed = requestSchema.safeParse(body.request);
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    const key = req.headers.get("cf-connecting-ip") || "local";
    const now = Date.now();
    for (const [k, t] of recent)
      if (t.every((v) => now - v > 60000)) recent.delete(k);
    const times = (recent.get(key) || []).filter((t) => now - t < 60000);
    if (times.length >= 8)
      return Response.json(
        { error: "Please wait a minute before generating another plan." },
        { status: 429 },
      );
    recent.set(key, [...times, now]);
    const provider = createProvider(
      body.demo
        ? {}
        : {
            key: process.env.AI_API_KEY,
            url: process.env.AI_CHAT_URL,
            model: process.env.AI_MODEL,
          },
    );
    const trip = await provider.generateItinerary(parsed.data);
    return Response.json({ trip });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return Response.json(
      {
        error:
          message.includes("abort") || message.includes("timeout")
            ? "Generation timed out. Retry or choose demo mode."
            : message.slice(0, 400),
      },
      { status: 502 },
    );
  }
}

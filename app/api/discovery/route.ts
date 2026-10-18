import snapshot from "@/lib/discovery-interest-snapshot.json";
import {
  interestSnapshotSchema,
  readershipReport,
  readershipWindow,
} from "@/lib/discovery-interest";

export const dynamic = "force-dynamic";
export async function GET() {
  const data = interestSnapshotSchema.parse(snapshot);
  const now = new Date();
  // Shared immutable publication snapshot. Zero visitor-triggered upstream calls.
  return Response.json(
    {
      updatedAt: data.updatedAt,
      lastAttemptAt: data.lastAttemptAt,
      retryAfter: data.retryAfter,
      thresholds: data.thresholds,
      requestedPeriod: readershipWindow(now),
      rows: readershipReport(data, now),
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=3600",
      },
    },
  );
}

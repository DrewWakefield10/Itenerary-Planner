import { destination } from "./destinations";
import type { Activity } from "./trip";

/** Town reference used when a day has no pinned stops (e.g. a transfer day). */
export function destinationCenter(slug: string): [number, number] {
  const d = destination(slug)!;
  return [d.lat, d.lng];
}

export function activityLocation(a: Pick<Activity, "lat" | "lng">): [number, number] | null {
  return a.lat === null || a.lng === null ? null : [a.lat, a.lng];
}

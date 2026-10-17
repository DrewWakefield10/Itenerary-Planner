import { tripSchema, type Trip } from "./trip";
import { readLocal, writeLocal } from "./storage";
export function readTrips(): Trip[] {
  const value = readLocal<unknown>("trips", []);
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const r = tripSchema.safeParse(v);
    return r.success ? [r.data] : [];
  });
}
export function saveTrip(trip: Trip) {
  const validated = tripSchema.safeParse(trip);
  if (!validated.success) return false;
  const trips = readTrips();
  return writeLocal("trips", [
    validated.data,
    ...trips.filter((t) => t.id !== trip.id),
  ]);
}
export function deleteTrip(id: string) {
  return writeLocal(
    "trips",
    readTrips().filter((t) => t.id !== id),
  );
}

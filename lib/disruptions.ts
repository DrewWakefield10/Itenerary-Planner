import { z } from "zod/v3";
import { sourceMetadataSchema } from "./sources";

export const disruptionSensitivitySchema = z.enum([
  "heavy-rain",
  "marine-conditions",
  "heat",
]);
export type DisruptionSensitivity = z.infer<typeof disruptionSensitivitySchema>;
export const openingHoursSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  source: sourceMetadataSchema,
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

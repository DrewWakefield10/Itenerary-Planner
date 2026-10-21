import {z} from "zod";
import {factSourcesSchema, sourcedLinkSchema} from "../sources";
import {openingHoursSchema, disruptionSensitivitySchema} from "../disruptions";
import {geographySchema} from "./directory-schema";
import {placeTypeSchema} from "./place-types";
import {entryPriceSchema,visitModeSchema} from "./practical-schema";
export {entryPriceSchema,visitModeSchema} from "./practical-schema";
const id=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const catalogStopSchema=z.object({
  geography:geographySchema.optional(),
  placeTypes:z.array(placeTypeSchema).optional(),
  id,baseSlug:id,canonicalId:id,name:z.string().min(1).max(160),aliases:z.array(z.string().min(1)),
  description:z.string().min(1).max(1500),interests:z.array(z.string().min(1)),
  lat:z.number().min(-90).max(90).nullable(),lng:z.number().min(-180).max(180).nullable(),
  category:z.string().min(1),cost:z.number().int().min(0).max(10000000),costBasis:z.enum(["person","group"]),entryPrice:entryPriceSchema,
  minutes:z.number().int().min(15).max(720),outdoor:z.boolean(),cluster:id,mode:visitModeSchema,scheduling:z.enum(["candidate","manual"]),
  transferMinutes:z.number().int().min(0).max(720),requiresBooking:z.boolean(),booking:z.string().min(1).max(600),
  includes:z.array(id),componentOf:z.array(id),distinct:z.boolean(),locationDetails:z.string().min(1).max(1000),
  accessibility:z.string().min(1).max(1000),transport:z.string().min(1).max(600),
  sources:factSourcesSchema,advisories:z.array(sourcedLinkSchema),
  disruptionSensitivities:z.array(disruptionSensitivitySchema).optional(),openingHours:openingHoursSchema.optional(),
}).superRefine((s,ctx)=>{
  if((s.lat===null)!==(s.lng===null))ctx.addIssue({code:"custom",message:"Coordinates must be supplied together"});
  if(s.sources.coordinates.status==="verified"&&s.lat===null)ctx.addIssue({code:"custom",message:"Verified coordinates need a point"});
  if(s.entryPrice.source.status==="verified"&&s.entryPrice.amount===null)ctx.addIssue({code:"custom",message:"A verified entry price needs an amount"});
  if(s.entryPrice.amount!==null&&s.entryPrice.basis==="unknown")ctx.addIssue({code:"custom",message:"A known price needs its unit"});
  if(s.openingHours && s.openingHours.opens>=s.openingHours.closes)ctx.addIssue({code:"custom",message:"Closing time must follow opening time"});
});

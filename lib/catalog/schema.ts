import {z} from "zod";
import {sourceMetadataSchema, factSourcesSchema, sourcedLinkSchema} from "../sources";
import {openingHoursSchema, disruptionSensitivitySchema} from "../disruptions";
import {geographySchema} from "./directory-schema";
export const visitModeSchema=z.enum(["local","excursion","package","separate-base"]);
export const entryPriceSchema=z.object({
  amount:z.number().nonnegative().max(10000000).nullable(),
  basis:z.enum(["person","group","unknown"]),source:sourceMetadataSchema,
}).superRefine((p,ctx)=>{
  if(p.amount===null&&p.source.status==="verified")ctx.addIssue({code:"custom",message:"Verified price needs an amount"});
  if(p.amount!==null&&p.basis==="unknown")ctx.addIssue({code:"custom",message:"Known price needs a unit"});
});
const id=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const catalogStopSchema=z.object({
  geography:geographySchema.optional(),
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

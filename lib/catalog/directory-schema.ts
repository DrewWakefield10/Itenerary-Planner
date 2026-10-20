import {z} from "zod";
import {sourceMetadataSchema} from "../sources";

export const destinationGroups=["Palawan","Cebu","Manila","Siargao","Bohol","Boracay","Baguio","Iloilo","Davao","Batanes","Sagada"] as const;
export const directoryCategories=["Attractions","Nature","Food & drink","Culture","Parks & markets"] as const;
export const geographySchema=z.object({
  destination_group:z.enum(destinationGroups),region:z.string().min(1),province:z.string().nullable(),
  city_municipality:z.string().min(1).nullable(),barangay:z.string().nullable(),address:z.string().nullable(),
  latitude:z.number().min(-90).max(90).nullable(),longitude:z.number().min(-180).max(180).nullable(),
  sources:z.object({identity:sourceMetadataSchema,municipality:sourceMetadataSchema,address:sourceMetadataSchema,coordinates:sourceMetadataSchema}),
});
export type DirectoryGeography=z.infer<typeof geographySchema>;
export const directoryCandidateSchema=geographySchema.extend({
  id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),name:z.string().min(1).max(160),
  category:z.enum(directoryCategories),description:z.string().min(1).max(1500),interests:z.array(z.string()),
  itinerary_base_slug:z.string().nullable(),catalog_stop_id:z.string().nullable(),
  status:z.enum(["accepted","rejected","unresolved"]),decision_reason:z.string().min(1),reviewed_on:z.string().nullable(),
}).superRefine((p,ctx)=>{
  if((p.latitude===null)!==(p.longitude===null))ctx.addIssue({code:"custom",message:"Coordinates must be supplied together"});
  if(p.status==="accepted"&&(!p.city_municipality||p.sources.identity.status!=="verified"||p.sources.municipality.status!=="verified"))ctx.addIssue({code:"custom",message:"Acceptance requires verified identity and municipality"});
  if(p.latitude===null&&p.sources.coordinates.status==="verified")ctx.addIssue({code:"custom",message:"Verified coordinates require a point"});
  if(p.latitude!==null&&!p.sources.coordinates.sourceUrl)ctx.addIssue({code:"custom",message:"Directory pins need a supporting source"});
});
export type DirectoryCandidate=z.infer<typeof directoryCandidateSchema>;

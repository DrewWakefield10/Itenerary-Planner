import {z} from "zod/v3";
import {sourceMetadataSchema} from "../sources";
export const visitModeSchema=z.enum(["local","excursion","package","separate-base"]);
export const entryPriceSchema=z.object({
  amount:z.number().nonnegative().max(10000000).nullable(),
  basis:z.enum(["person","group","unknown"]),source:sourceMetadataSchema,
}).superRefine((p,ctx)=>{
  if(p.amount===null&&p.source.status==="verified")ctx.addIssue({code:"custom",message:"Verified price needs an amount"});
  if(p.amount!==null&&p.basis==="unknown")ctx.addIssue({code:"custom",message:"Known price needs a unit"});
});

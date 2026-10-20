import type {Stop} from "./types";
import {catalogStopSchema} from "./schema";
import {normalizePlaceName} from "./identity";

/** Structural checks cannot verify a source's factual claims or current access. */
export function validateCatalog(groups:{slug:string;stops:Stop[]}[]) {
  const errors:string[]=[];
  const ids=new Map<string,Stop>();
  for(const base of groups) {
    const names=new Map<string,string>();
    for(const s of base.stops) {
      const parsed=catalogStopSchema.safeParse(s);
      if(!parsed.success)errors.push(`${s.id}: ${parsed.error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")}`);
      if(s.baseSlug!==base.slug)errors.push(`${s.id}: incorrect parent ${s.baseSlug}`);
      if(ids.has(s.id))errors.push(`${s.id}: duplicate ID`);
      ids.set(s.id,s);
      for(const name of [s.name,...s.aliases]) {
        const key=normalizePlaceName(name),other=names.get(key);
        if(other&&other!==s.canonicalId)errors.push(`${s.id}: duplicate name or alias ${name}`);
        names.set(key,s.canonicalId);
      }
      if(s.mode==="package"&&!s.includes.length)errors.push(`${s.id}: package needs component references`);
      if(s.mode!=="package"&&s.includes.length)errors.push(`${s.id}: only packages have includes`);
    }
  }
  for(const s of ids.values()) {
    for(const id of [...s.includes,...s.componentOf]) {
      const other=ids.get(id);
      if(!other)errors.push(`${s.id}: missing component/package ${id}`);
      else if(other.baseSlug!==s.baseSlug)errors.push(`${s.id}: cross-base package ${id}`);
      else if(id===s.id)errors.push(`${s.id}: self reference`);
    }
    for(const id of s.includes)if(ids.get(id)?.mode==="package")errors.push(`${s.id}: nested packages are not supported`);
    for(const id of s.componentOf)if(!ids.get(id)?.includes.includes(s.id))errors.push(`${s.id}: package relationship is not reciprocal: ${id}`);
  }
  return errors;
}

import raw from "./food-profiles.json";
import {foodProfileSchema} from "./food-schema";
import type {Stop} from "./types";
import type {PlaceType} from "./place-types";
export const foodProfiles=raw.map(p=>foodProfileSchema.parse(p));
const profiles=new Map(foodProfiles.map(p=>[p.placeId,p]));
export const foodForPlace=(id:string)=>profiles.get(id);
export const foodFilters={all:"All food types",cafe:"Cafés & coffee",meal:"Dining",bakery:"Bakeries",dessert:"Desserts",breakfast:"Breakfast",market:"Food markets"};
export function matchesFoodFilter(id:string,filter:string){
  if(filter==="all")return true;
  const food=foodForPlace(id);
  return !!food&&(filter==="cafe"?food.primary==="cafe"||food.suitability.includes("coffee"):filter==="market"?food.venueType==="food-market":food.suitability.some(s=>s===filter));
}
export function foodPlaceTypes(id:string):PlaceType[]{
  const p=foodForPlace(id);if(!p)return [];
  if(p.venueType==="food-market")return ["market"];
  return [...(p.primary==="cafe"||p.suitability.includes("coffee")?["cafe" as const]:[]),...(p.suitability.includes("meal")?["restaurant" as const]:[]),...(p.venueType==="bakery"?["bakery" as const]:[])];
}
export const isFoodStop=(s:Stop)=>!!foodForPlace(s.id)||!!s.placeTypes?.some(t=>["cafe","restaurant","bakery","bar"].includes(t))||!s.placeTypes?.length&&s.category==="Food";
export const isMealStop=(s:Stop)=>foodForPlace(s.id)?.suitability.includes("meal")??!!s.placeTypes?.includes("restaurant");
export const isCoffeeStop=(s:Stop)=>foodForPlace(s.id)?.suitability.includes("coffee")??!!s.placeTypes?.includes("cafe");

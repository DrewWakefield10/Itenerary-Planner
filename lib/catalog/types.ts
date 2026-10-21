import type {FactSources, SourceMetadata, SourcedLink} from "../sources";
import type {DisruptionSensitivity, OpeningHours} from "../disruptions";
import type {DirectoryGeography} from "./directory-schema";
import type {PlaceType} from "./place-types";

export type VisitMode = "local" | "excursion" | "package" | "separate-base";
export type EntryPrice = {amount:number|null;basis:"person"|"group"|"unknown";source:SourceMetadata};
export type Stop = {
  id:string;
  geography?:DirectoryGeography;
  baseSlug:string;
  /** Shared identity for access points/aliases of the same attraction. */
  canonicalId:string;
  name:string;
  aliases:string[];
  description:string;
  interests:string[];
  lat:number|null;
  lng:number|null;
  category:string;
  placeTypes?:PlaceType[];
  /** Budget allowance; an unknown entry price must never be displayed as free. */
  cost:number;
  costBasis:"person"|"group";
  entryPrice:EntryPrice;
  minutes:number;
  outdoor:boolean;
  cluster:string;
  mode:VisitMode;
  scheduling:"candidate"|"manual";
  transferMinutes:number;
  requiresBooking:boolean;
  booking:string;
  includes:string[];
  componentOf:string[];
  /** Generic legacy meal/rest ideas remain usable, but are not distinct venues. */
  distinct:boolean;
  locationDetails:string;
  accessibility:string;
  transport:string;
  sources:FactSources;
  advisories:SourcedLink[];
  disruptionSensitivities?:DisruptionSensitivity[];
  openingHours?:OpeningHours;
};
export type LegacyStop = Omit<Stop,"id"|"baseSlug"|"canonicalId"|"aliases"|"description"|"interests"|"costBasis"|"entryPrice"|"mode"|"scheduling"|"transferMinutes"|"requiresBooking"|"booking"|"includes"|"componentOf"|"distinct">;
export type ResearchedSpot = {
  id:string;baseSlug:string;name:string;category:string;interests:string[];description:string;
  cluster:string;lat:number|null;lng:number|null;cost:number|null;costBasis:"person"|"group"|"unknown";
  minutes:number;outdoor:boolean;mode:VisitMode;booking:string;transport:string;locationDetails:string;
  accessibility?:string;aliases?:string[];requiresBooking?:boolean;openingHours?:OpeningHours;
  includes?:string[];componentOf?:string[];
  evidence:{fields:string[];sourceName:string;sourceUrl:string;dateChecked:string;status:"verified"|"estimate"|"unverified"}[];
};

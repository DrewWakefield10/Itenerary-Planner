"use client";
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart, Sun } from "lucide-react";
import {
  destination,
  destinationImage,
  peso,
  type Destination,
} from "@/lib/destinations";
import { readLocal, writeLocal } from "@/lib/storage";
import { useAccount } from "./account-provider";
import { BookmarkButton } from "./bookmarks";
function subscribeFavorites(update: () => void) {
  window.addEventListener("storage", update);
  window.addEventListener("lakbay-favorites-changed", update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener("lakbay-favorites-changed", update);
  };
}
const favoritesSnapshot = () => {
  const saved = readLocal<unknown>("favorites", []);
  return JSON.stringify(
    Array.isArray(saved) ? saved.filter((v) => typeof v === "string") : [],
  );
};
export function useDeviceFavorites() {
  const snapshot = useSyncExternalStore(
    subscribeFavorites,
    favoritesSnapshot,
    () => "[]",
  );
  return useMemo(() => JSON.parse(snapshot) as string[], [snapshot]);
}
export function Photo({
  slug,
  className = "",
  eager = false,
}: {
  slug: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      className={className}
      src={destinationImage(slug)}
      alt={`${destination(slug)?.name || slug} scenery`}
      loading={eager ? "eager" : "lazy"}
    />
  );
}
export function Stamp() {
  return (
    <div className="stamp">
      <Sun size={27} />
      <span>PHILIPPINES</span>
      <small>GO. WANDER. REPEAT.</small>
    </div>
  );
}
export function DestinationCard({
  d,
  index = 0,
  guide = false,
}: {
  d: Destination;
  index?: number;
  guide?: boolean;
}) {
  const account = useAccount();
  const favorites = useDeviceFavorites();
  const saved = favorites.includes(d.slug);
  return (
    <article className={`postcard card-${index % 3}`}>
      <Link href={`/destinations/${d.slug}`} className="photo-link">
        <Photo slug={d.slug} />
        <span className="destination-tag">{d.tags[0]}</span>
      </Link>
      {!account.enabled && (
        <button
          className={`heart ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${d.name} on this device`}
          title="Device favorite; not an account bookmark"
          onClick={() => {
            const list = favorites;
            if (
              writeLocal(
                "favorites",
                saved ? list.filter((s) => s !== d.slug) : [...list, d.slug],
              )
            )
              window.dispatchEvent(new Event("lakbay-favorites-changed"));
          }}
        >
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      )}
      <div className="postcard-body">
        <small>{d.province ? `${d.province} · ${d.region}` : d.region}</small>
        <Link href={`/destinations/${d.slug}`}>
          <h3>
            {d.name}
            <ArrowUpRight size={21} />
          </h3>
        </Link>
        <p>{guide ? d.description : d.caption}</p>
        <BookmarkButton placeId={`base-${d.slug}`} name={d.name} />
        <div className="card-meta">
          <span>
            {d.days}–{d.days + 2} days suggested
          </span>
          <span>Estimate: {peso(d.daily)} / day*</span>
        </div>
      </div>
    </article>
  );
}

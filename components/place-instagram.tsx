"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { instagramGalleryForPlace } from "@/lib/catalog/instagram";
import type { InstagramRecord } from "@/lib/catalog/instagram-schema";
import type { DiscoveryPlace } from "@/lib/discovery";
import {
  loadInstagramRuntime,
  processInstagramEmbeds,
} from "@/lib/instagram-embed";
import { PlacePhoto } from "./place-media";

function InstagramSlot({ record }: { record: InstagramRecord }) {
  const host = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setFits(entries[0].contentRect.width >= 326),
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const container = host.current;
    if (!fits || !container) return;
    // The official runtime replaces this markup. React owns only the host.
    const quote = document.createElement("blockquote");
    const link = document.createElement("a");
    quote.className = "instagram-media";
    quote.dataset.instgrmPermalink = record.url;
    quote.dataset.instgrmVersion = "14";
    link.href = record.url;
    link.textContent = "View this post on Instagram";
    link.target = "_blank";
    link.rel = "noreferrer";
    quote.appendChild(link);
    container.replaceChildren(quote);
    processInstagramEmbeds();
    const timer = setTimeout(() => setWaiting(true), 12000);
    return () => {
      clearTimeout(timer);
      container.replaceChildren();
    };
  }, [fits, record.url]);
  return (
    <div className="place-instagram-slot">
      <div ref={host} />
      {!fits && (
        <p className="fine-print">
          Open the original post to see it at this screen width.
        </p>
      )}
      {fits && waiting && (
        <p className="fine-print">
          If the post is blank or unavailable, use the original link.
        </p>
      )}
    </div>
  );
}

export function InstagramGallery({ place }: { place: DiscoveryPlace }) {
  const records = instagramGalleryForPlace(place.id, place.image);
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "failed">(
    "idle",
  );
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const enable = () => {
    setState("loading");
    loadInstagramRuntime()
      .then(() => {
        setState("loaded");
        const track = viewport.current;
        setVisited(
          new Set([
            track
              ? Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
              : 0,
          ]),
        );
      })
      .catch(() => setState("failed"));
  };
  const update = (index: number) => {
    setActive(index);
    if (state === "loaded")
      setVisited((previous) =>
        previous.has(index) ? previous : new Set([...previous, index]),
      );
  };
  const go = (index: number) => {
    const track = viewport.current;
    if (!track) return;
    const next = Math.max(0, Math.min(index, records.length - 1));
    // Scroll only the strip. Native touch scrolling uses the same snap points.
    track.scrollTo({ left: next * track.clientWidth, behavior: "instant" });
    update(next);
  };
  useEffect(() => {
    const track = viewport.current;
    if (!track || records.length <= 1) return;
    let width = track.clientWidth;
    const observer = new ResizeObserver(() => {
      if (track.clientWidth === width) return;
      width = track.clientWidth;
      track.scrollTo({ left: active * width, behavior: "instant" });
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [active, records.length]);
  if (!records.length) return null;
  const canEmbed = records.some(
    (record) => !record.photo && record.presentation === "manual-embed",
  );
  const multiple = records.length > 1;
  return (
    <section
      id="instagram-photos"
      className="instagram-gallery"
      aria-labelledby="instagram-gallery-heading"
    >
      <div className="instagram-gallery-heading">
        <h2 id="instagram-gallery-heading">More photos from Instagram</h2>
        {multiple && (
          <div className="instagram-gallery-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous Instagram post"
              aria-controls="instagram-posts"
              disabled={active === 0}
              onClick={() => go(active - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span role="status" aria-live="polite">
              {active + 1} of {records.length}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Next Instagram post"
              aria-controls="instagram-posts"
              disabled={active === records.length - 1}
              onClick={() => go(active + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      {canEmbed && state !== "loaded" && (
        <div className="instagram-gallery-consent">
          <p className="fine-print">
            Loading posts connects to Instagram, which may use cookies.
          </p>
          <button
            type="button"
            className="button secondary small"
            disabled={state === "loading"}
            onClick={enable}
          >
            {state === "failed"
              ? "Try loading Instagram posts again"
              : state === "loading"
                ? "Loading Instagram posts…"
                : "Load Instagram posts"}
          </button>
          {state === "failed" && (
            <p className="fine-print" role="status">
              Instagram could not load here. You can still open each original
              post.
            </p>
          )}
        </div>
      )}
      <div
        ref={viewport}
        id="instagram-posts"
        className="instagram-gallery-track"
        role="group"
        aria-label="Instagram posts"
        tabIndex={multiple ? 0 : undefined}
        onScroll={(event) => {
          const track = event.currentTarget;
          const index = Math.round(
            track.scrollLeft / Math.max(1, track.clientWidth),
          );
          if (index >= 0 && index < records.length) update(index);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const keys: Record<string, number> = {
            ArrowLeft: active - 1,
            ArrowRight: active + 1,
            Home: 0,
            End: records.length - 1,
          };
          const target = keys[event.key];
          if (target !== undefined) {
            event.preventDefault();
            go(target);
          }
        }}
      >
        {records.map((record, index) => (
          <article
            className="instagram-gallery-item"
            aria-label={
              multiple
                ? "Post " + (index + 1) + " of " + records.length
                : undefined
            }
            key={record.url}
          >
            {record.photo && (
              <figure>
                <PlacePhoto
                  key={record.photo.asset.src}
                  place={{
                    ...place,
                    image: { ...record.photo.asset, creditUrl: record.url },
                  }}
                />
                <figcaption>
                  {record.photo.asset.attribution} ·{" "}
                  <a
                    href={record.photo.asset.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reuse credit
                  </a>
                </figcaption>
              </figure>
            )}
            {state === "loaded" &&
              visited.has(index) &&
              !record.photo &&
              record.presentation === "manual-embed" && (
                <InstagramSlot record={record} />
              )}
            <div className="instagram-gallery-caption">
              <strong>@{record.account}</strong>
              <p>{record.relevance}</p>
              <a
                className="text-link"
                href={record.url}
                target="_blank"
                rel="noreferrer"
                aria-label={"View on Instagram — " + record.accountName}
              >
                View on Instagram ↗
              </a>
              {!record.photo && record.presentation === "link-only" && (
                <span className="fine-print"> · Original post link</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

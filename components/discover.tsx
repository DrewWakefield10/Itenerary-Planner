"use client";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Compass,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import {
  discoveryPlaces,
  discoveryPlace,
  discoveryStop,
  nearbyDiscoveries,
  reviewExpired,
  placeCoordinates,
  type DiscoveryPlace,
} from "@/lib/discovery";
import { destination, peso } from "@/lib/destinations";
import {
  destinationGroups,
  directoryCategories,
  directoryListings,
  directoryGroupImages,
  filterDirectory,
  groupForBase,
} from "@/lib/catalog/directory";
import { addableStop } from "@/lib/catalog/planning";
import { blankActivity } from "@/lib/engine";
import {
  interestFresh,
  signalLabel,
  interestCaveat,
  type ReadershipRow,
} from "@/lib/discovery-interest";
import { SourceIndicator, SourceReviewNote } from "./source-indicator";
import {directoryDetails} from "@/lib/catalog/directory-details";
import {unverifiedSource} from "@/lib/sources";
const AddDialog = lazy(() => import("./discovery-add-dialog"));
const TripMap = lazy(() => import("./trip-map"));
const dayLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const timestamp = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
type InterestResponse = {
  updatedAt: string | null;
  lastAttemptAt: string | null;
  retryAfter: string | null;
  thresholds: {
    baseline: number;
    absoluteGrowth: number;
    percentGrowth: number;
    freshnessHours: number;
  };
  requestedPeriod: { start: string; end: string };
  rows: ReadershipRow[];
};

function PlaceCard({
  place,
  onAdd,
  signal,
  distance,
}: {
  place: DiscoveryPlace;
  onAdd?: (id: string) => void;
  signal?: ReadershipRow;
  distance?: number;
}) {
  const base = destination(place.baseSlug);
  const stop = discoveryStop(place);
  return (
    <article className="discovery-card">
      <Link href={`/discover/${place.id}`} className="discovery-photo">
        {place.image ? (
          <img src={place.image.src} alt={place.image.alt} loading="lazy" />
        ) : (
          <div className="discovery-art">
            <Compass size={62} strokeWidth={1} />
            <span>{place.name}</span>
          </div>
        )}
        <span className="discovery-kind">
          {place.kind === "base" ? "Overnight base" : "Individual stop"}
        </span>
      </Link>
      <div className="discovery-card-body">
        <p className="eyebrow">
          {place.directory?.city_municipality || base?.name}
          {place.directory
            ? ` / ${place.directory.destination_group}`
            : base?.province
              ? ` / ${base.province}`
              : ""}{" "}
          · {place.category}
        </p>
        <Link href={`/discover/${place.id}`}>
          <h3>
            {place.name}
            <ArrowUpRight size={18} />
          </h3>
        </Link>
        <p>{place.description}</p>
        <p className="discovery-reason">
          <Sparkles size={14} />
          {signal ? signalLabel : place.reason}
        </p>
        {distance !== undefined && (
          <p className="discovery-distance">
            <MapPin size={14} />
            {distance.toFixed(1)} km straight-line distance
          </p>
        )}
        {signal?.comparison && signal.data && (
          <div className="discovery-signal">
            <strong>
              +{Math.round(signal.comparison.percent!)}% readership
            </strong>
            <span>
              {signal.comparison.latest.toLocaleString()} human-reader pageviews
              · English Wikipedia
            </span>
            <span>
              {dayLabel(signal.comparison.latestStart)}–
              {dayLabel(signal.comparison.latestEnd)} vs{" "}
              {dayLabel(signal.comparison.previousStart)}–
              {dayLabel(signal.comparison.previousEnd)} (UTC)
            </span>
            <a href={signal.data.sourceUrl} target="_blank" rel="noreferrer">
              Wikimedia data ↗
            </a>
            <span>Fetched {timestamp(signal.data.fetchedAt)}</span>
          </div>
        )}
        <div className="discovery-attribution">
          <span>
            {signal
              ? "Readership signal + reviewed place"
              : "Catalog discovery"}
          </span>
          <SourceIndicator source={place.source} label="Description" />
          {place.reviewedOn && (
            <time dateTime={place.reviewedOn}>
              Reviewed {dayLabel(place.reviewedOn)}
            </time>
          )}
          {reviewExpired(place) && <span>Review needs updating</span>}
        </div>
        <div className="discovery-actions">
          <Link
            className="text-link"
            href={
              place.baseSlug
                ? `/planner?destinations=${place.baseSlug}`
                : "/planner"
            }
          >
            {place.baseSlug ? "Plan a trip here" : "Choose an overnight base"}{" "}
            <ArrowUpRight size={14} />
          </Link>
          {place.kind === "spot" && place.baseSlug && stop && onAdd && (
            <button
              className="text-link plain-button"
              disabled={reviewExpired(place) || (!!stop && !addableStop(stop))}
              onClick={() => onAdd(place.id)}
            >
              Add to my trip +
            </button>
          )}
          <Link className="discovery-view" href={`/discover/${place.id}`}>
            View place
          </Link>
        </div>
      </div>
    </article>
  );
}
export function DiscoveryTeaser() {
  return (
    <section className="page section discovery-teaser">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FIELD NOTES / SMALL DISCOVERIES</span>
          <h2>
            A little detour. <em>A good story.</em>
          </h2>
          <p>Reviewed places you can turn into a plan, one stop at a time.</p>
        </div>
        <Link href="/discover" className="text-link">
          Discover places <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="discovery-grid">
        {[
          "baguio-burnham-park",
          "cebu-casa-gorordo",
          "puerto-princesa-plaza-cuartel",
        ].map((id) => (
          <PlaceCard key={id} place={discoveryPlace(id)!} />
        ))}
      </div>
    </section>
  );
}
export default function Discover({ placeId }: { placeId?: string }) {
  const [search, setSearch] = useState(""),
    [area, setArea] = useState("all"),
    [category, setCategory] = useState("all"),
    [interestFilter, setInterestFilter] = useState("all"),
    [page, setPage] = useState(1),
    [showBases, setShowBases] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const group =
        params.get("destination") || groupForBase(params.get("base"));
      setArea(
        group &&
          destinationGroups.includes(
            group as (typeof destinationGroups)[number],
          )
          ? group
          : "all",
      );
      setCategory(params.get("category") || "all");
      setInterestFilter(params.get("interest") || "all");
      setSearch(params.get("q") || "");
      setPage(Math.max(1, Number(params.get("page")) || 1));
      setFiltersReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!filtersReady || placeId) return;
    const params = new URLSearchParams();
    if (area !== "all") params.set("destination", area);
    if (category !== "all") params.set("category", category);
    if (interestFilter !== "all") params.set("interest", interestFilter);
    if (search) params.set("q", search);
    if (page > 1) params.set("page", String(page));
    window.history.replaceState(
      null,
      "",
      `/discover${params.size ? `?${params}` : ""}`,
    );
  }, [area, category, interestFilter, search, page, filtersReady, placeId]);
  const [nearBase, setNearBase] = useState("baguio"),
    [adding, setAdding] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [interest, setInterest] = useState<InterestResponse | null>(null),
    [interestLoaded, setInterestLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    fetch("/api/discovery", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<InterestResponse>;
      })
      .then(setInterest)
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setInterestLoaded(true);
      });
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  const place = placeId ? discoveryPlace(placeId) : undefined;
  const bases = discoveryPlaces.filter((p) => p.kind === "base");
  const categories = directoryCategories;
  const acceptedIds = new Set(
    filterDirectory({
      group: area,
      category,
      interest: interestFilter,
      search,
    }).map((p) => p.id),
  );
  const matches = (p: DiscoveryPlace) =>
    p.kind === "spot"
      ? acceptedIds.has(p.id)
      : (area === "all" || groupForBase(p.baseSlug) === area) &&
        category === "all" &&
        interestFilter === "all" &&
        `${p.name} ${p.description} ${groupForBase(p.baseSlug) || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
  const rows = (interest?.rows || []).map((row) => ({
    ...row,
    fresh:
      row.fresh &&
      !!row.data &&
      interestFresh(row.data, currentTime, interest!.thresholds.freshnessHours),
  }));
  const trends = rows
    .filter((row) => row.qualifies && row.fresh)
    .sort(
      (a, b) => (b.comparison?.increase || 0) - (a.comparison?.increase || 0),
    );
  const nearby = nearbyDiscoveries(nearBase);
  const spots = discoveryPlaces.filter((p) => p.kind === "spot" && matches(p));
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(spots.length / 12))));
  }, [spots.length, page]);
  const interests = [
    ...new Set(discoveryPlaces.flatMap((p) => p.interests || [])),
  ].sort();
  return (
    <section className="page section discover-page">
      {placeId ? (
        <>
          {place ? (
            <PlaceDetails place={place} onAdd={setAdding} />
          ) : (
            <div className="empty">
              <h1>This discovery is not in the reviewed collection.</h1>
              <Link href="/discover" className="button">
                Browse discoveries
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="discover-intro">
            <div>
              <span className="eyebrow">
                CURIOUS BY NATURE / LAKBAY DISCOVER
              </span>
              <h1 className="page-title">
                Good places.
                <br />
                <em>Little detours.</em>
              </h1>
              <p className="lede">
                Find a place that catches your eye. Give it a page in your
                travel journal.
              </p>
              <p>
                Choose an overnight base, or discover individual stops to visit
                while staying there.
              </p>
            </div>
            <div className="discovery-journal-mark" aria-hidden="true">
              <Compass size={84} strokeWidth={1} />
              <span className="handwritten">Follow your curiosity.</span>
              <small>PLACES FIRST. STORIES FOLLOW.</small>
            </div>
          </div>
          <section
            className="explore-destinations"
            aria-labelledby="explore-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="explore-title">
                  Explore <em>Destinations.</em>
                </h2>
                <p>
                  {directoryListings.length} reviewed locations across 11
                  browsing destinations. Each place keeps its actual city or
                  municipality.
                </p>
              </div>
            </div>
            <div className="destination-directory-grid">
              {destinationGroups.map((group) => (
                <button
                  key={group}
                  className={
                    area === group
                      ? "directory-destination selected"
                      : "directory-destination"
                  }
                  aria-pressed={area === group}
                  onClick={() => {
                    setArea(area === group ? "all" : group);
                    setPage(1);
                  }}
                >
                  <img
                    src={`/images/${directoryGroupImages[group]}.jpg`}
                    loading="lazy"
                    alt=""
                  />
                  <span>
                    <strong>
                      {group === "Manila" ? "Metro Manila" : group}
                    </strong>
                    <small>
                      {
                        directoryListings.filter(
                          (p) => p.destination_group === group,
                        ).length
                      }{" "}
                      locations
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <div className="discovery-filters">
            <label className="discovery-search">
              <span>
                <Search size={16} />
                Search places
              </span>
              <input
                type="search"
                placeholder="A garden, a city, a little inspiration…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Browsing destination
              <select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All 11 destinations</option>
                {destinationGroups.map((group) => (
                  <option key={group} value={group}>
                    {group === "Manila" ? "Manila (Metro Manila)" : group} (
                    {
                      directoryListings.filter(
                        (p) => p.destination_group === group,
                      ).length
                    }
                    )
                  </option>
                ))}
              </select>
            </label>
            <label>
              Place category
              <select
                aria-label="Place category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All place categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Travel interest
              <select
                aria-label="Travel interest"
                value={interestFilter}
                onChange={(e) => {
                  setInterestFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All interests</option>
                {interests.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
          </div>
          {(search ||
            area !== "all" ||
            category !== "all" ||
            interestFilter !== "all") && (
            <button
              className="text-link plain-button"
              onClick={() => {
                setSearch("");
                setArea("all");
                setCategory("all");
                setInterestFilter("all");
                setPage(1);
              }}
            >
              Clear all filters
            </button>
          )}
          <section
            className="discovery-interest-section"
            aria-labelledby="attention-title"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">01 / A SIGNAL OF CURIOSITY</span>
                <h2 id="attention-title">
                  Gaining <em>attention.</em>
                </h2>
              </div>
              <span className="discovery-note-tag">WIKIPEDIA READERSHIP</span>
            </div>
            <p>{interestCaveat}</p>
            <p className="fine-print">
              Only {discoveryPlaces.filter((p) => p.wikipedia).length}{" "}
              explicitly matched English articles are monitored. Eligible places
              need a meaningful baseline and growth; unlisted places may still
              be worth discovering.
            </p>
            {!interestLoaded ? (
              <p role="status">Opening readership notes…</p>
            ) : (
              <>
                <p className="fine-print">
                  {interest?.updatedAt
                    ? `Last successful data: ${timestamp(interest.updatedAt)}.`
                    : "No successful readership snapshot is available."}
                  {interest?.lastAttemptAt
                    ? ` Last refresh attempt: ${timestamp(interest.lastAttemptAt)}.`
                    : ""}
                </p>
                {trends.filter((row) => {
                  const p = discoveryPlace(row.placeId);
                  return p && matches(p);
                }).length ? (
                  <div className="discovery-grid">
                    {trends
                      .filter((row) => matches(discoveryPlace(row.placeId)!))
                      .map((row) => (
                        <PlaceCard
                          key={row.placeId}
                          place={discoveryPlace(row.placeId)!}
                          signal={row}
                          onAdd={setAdding}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="discovery-empty">
                    <Compass size={29} />
                    <p>
                      {!interest || !rows.some((row) => row.fresh)
                        ? "Current interest data is unavailable. Reviewed discoveries below are ready to explore."
                        : trends.length
                          ? "No readership signals match these filters."
                          : "No monitored place meets the current readership-growth thresholds. Explore the selected discoveries below."}
                    </p>
                  </div>
                )}
                {interest && (
                  <details className="discovery-coverage">
                    <summary>
                      Readership coverage, freshness & methodology
                    </summary>
                    <p>
                      Latest requested comparison:{" "}
                      {dayLabel(interest.requestedPeriod.start)}–
                      {dayLabel(interest.requestedPeriod.end)} UTC, split into
                      two complete seven-day periods. Each successful record
                      below shows its actual coverage.
                    </p>
                    <p>
                      Minimum preceding-week volume:{" "}
                      {interest.thresholds.baseline} views; minimum absolute
                      increase: {interest.thresholds.absoluteGrowth}; minimum
                      growth: {interest.thresholds.percentGrowth}%. Percentages
                      are suppressed below the baseline. Data older than{" "}
                      {interest.thresholds.freshnessHours} hours is excluded
                      from rankings. Missing days are unavailable, never filled
                      with zero.
                    </p>
                    <p>
                      Snapshots are refreshed by Lakbay's maintainer and shared
                      with all visitors. The page does not refresh Wikimedia per
                      card or per visitor. Redirect traffic is not combined with
                      the reviewed canonical article.
                    </p>
                    <ul>
                      {rows.map((row) => (
                        <li key={row.placeId}>
                          <strong>{discoveryPlace(row.placeId)?.name}</strong> ·{" "}
                          {row.data && row.comparison ? (
                            <>
                              <a
                                href={row.data.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {row.title} ↗
                              </a>
                              <br />
                              {dayLabel(row.data.start)}–
                              {dayLabel(row.data.end)} UTC ·{" "}
                              {row.comparison.previous.toLocaleString()} →{" "}
                              {row.comparison.latest.toLocaleString()} weekly
                              views
                              {row.comparison.percent === null
                                ? " · percentage suppressed"
                                : ` · ${row.comparison.percent.toFixed(1)}%`}
                              . Fetched {timestamp(row.data.fetchedAt)} ·{" "}
                              {row.fresh
                                ? "Within freshness window"
                                : "Stale — excluded from rankings"}
                              .
                            </>
                          ) : (
                            "Readership unavailable."
                          )}
                          {row.error && (
                            <span>
                              {" "}
                              Latest attempt: {row.error} Last successful data,
                              when present, is retained.
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <a
                      href="https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Wikimedia Analytics API documentation ↗
                    </a>
                    <span> · </span>
                    <a
                      href="https://creativecommons.org/publicdomain/zero/1.0/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Pageview data: CC0 ↗
                    </a>
                  </details>
                )}
              </>
            )}
          </section>
          <section className="discovery-section" aria-labelledby="spots-title">
            <span className="eyebrow">02 / THE PLACE COLLECTION</span>
            <h2 id="spots-title">
              Spots to <em>discover.</em>
            </h2>
            <p>
              Named places with reviewed identity and municipality. Check each
              fact's source; unknown details remain unknown. Catalog inclusion
              is not a popularity ranking.
            </p>
            <div className="discovery-grid">
              {spots.slice((page - 1) * 12, page * 12).map((p) => (
                <PlaceCard key={p.id} place={p} onAdd={setAdding} />
              ))}
            </div>
            <div className="catalog-pagination" aria-label="Catalog pages">
              <span role="status">
                {spots.length} matching locations
                {area !== "all" ? ` in ${area}` : " across all destinations"} /
                Page {page} of {Math.max(1, Math.ceil(spots.length / 12))}
              </span>
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous spots
              </button>
              <button
                className="button secondary"
                disabled={page * 12 >= spots.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next spots
              </button>
            </div>
            {!spots.length && (
              <p className="discovery-empty">
                No locations match these filters. Clear a filter or try another
                name or municipality.
              </p>
            )}
          </section>
          <section className="discovery-section" aria-labelledby="bases-title">
            <span className="eyebrow">A PLACE TO STAY / A STARTING POINT</span>
            <h2 id="bases-title">
              Find your <em>overnight base.</em>
            </h2>
            <p>
              Changing bases reserves a connection day. Visiting a local stop
              keeps you at the same base.
            </p>
            <div className="discovery-grid">
              {bases
                .filter(matches)
                .slice(0, showBases ? undefined : 6)
                .map((p) => (
                  <PlaceCard key={p.id} place={p} />
                ))}
            </div>
            {bases.filter(matches).length > 6 && (
              <button
                className="button secondary"
                onClick={() => setShowBases((v) => !v)}
              >
                {showBases ? "Show fewer bases" : "Show all overnight bases"}
              </button>
            )}
            {!bases.some(matches) && (
              <p className="discovery-empty">
                No reviewed bases match these filters.
              </p>
            )}
          </section>
          <section className="discovery-section" aria-labelledby="nearby-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">03 / A LITTLE CLOSER</span>
                <h2 id="nearby-title">
                  Explore <em>nearby.</em>
                </h2>
              </div>
              <label>
                Nearby overnight base
                <select
                  value={nearBase}
                  onChange={(e) => setNearBase(e.target.value)}
                >
                  {bases.map((p) => (
                    <option key={p.id} value={p.baseSlug!}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              {nearby.origin
                ? `From the reviewed ${nearby.origin.name} reference pin. Distances are straight-line estimates within 15 km, not road distances or travel times.`
                : "No reviewed reference pin is available for this base yet."}
            </p>
            <div className="discovery-grid">
              {nearby.spots
                .filter(({ place }) => matches(place))
                .map(({ place, km }) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    distance={km}
                    onAdd={setAdding}
                  />
                ))}
            </div>
            {!nearby.spots.filter(({ place }) => matches(place)).length && (
              <p className="discovery-empty">
                No nearby spots with verified coordinates match this selection.
                Unverified pins are excluded.
              </p>
            )}
          </section>
          <div className="directory-downloads">
            <a href="/data/lakbay-locations.json" download>
              Download directory JSON
            </a>
            <a href="/data/lakbay-locations.csv" download>
              Download directory CSV
            </a>
            <a href="/data/research-progress.json" download>
              Research progress
            </a>
          </div>
          <SourceReviewNote />
        </>
      )}
      {adding && (
        <Suspense fallback={<p role="status">Opening your journal…</p>}>
          <AddDialog
            key={adding}
            placeId={adding}
            onClose={() => setAdding(null)}
          />
        </Suspense>
      )}
    </section>
  );
}

function PlaceDetails({
  place,
  onAdd,
}: {
  place: DiscoveryPlace;
  onAdd: (id: string) => void;
}) {
  const [showMap, setShowMap] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const base = destination(place.baseSlug);
  const stop = discoveryStop(place);
  const notes=stop||(place.directory?directoryDetails(place.directory):null);
  const point = placeCoordinates(place);
  const nearby = place.baseSlug
    ? nearbyDiscoveries(place.baseSlug, place.id)
    : { origin: null, spots: [] };
  const mapActivity = useMemo(
    () => ({
      ...blankActivity(place.name),
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    }),
    [place.name, point?.lat, point?.lng],
  );
  return (
    <>
      <Link href="/discover" className="breadcrumb">
        <ArrowLeft size={14} /> Back to Discover
      </Link>
      <div className="discovery-detail-hero">
        <div>
          <span className="eyebrow">
            {place.kind === "base" ? "OVERNIGHT BASE" : "INDIVIDUAL STOP"} /{" "}
            {place.directory?.destination_group || base?.name} /{" "}
            {place.category}
          </span>
          <h1 className="page-title">{place.name}</h1>
          <p className="lede">{place.description}</p>
          <SourceIndicator source={place.source} label="Description" />
          <p className="discovery-reason">{place.reason}</p>
          <div className="discovery-actions">
            <Link
              className="button"
              href={
                place.baseSlug
                  ? `/planner?destinations=${place.baseSlug}`
                  : "/planner"
              }
            >
              {place.baseSlug ? "Plan a trip here" : "Choose an overnight base"}{" "}
              <ArrowUpRight size={16} />
            </Link>
            {stop && place.baseSlug && (
              <button
                className="button secondary"
                disabled={
                  !interactive || reviewExpired(place) || !addableStop(stop)
                }
                onClick={() => onAdd(place.id)}
              >
                Add to my trip
              </button>
            )}
          </div>
          <p className="fine-print">
            {place.kind === "spot"
              ? place.baseSlug
                ? `Mapped to the ${base?.name} overnight base. Confirm transfers before adding a visit.`
                : "This place has no reviewed itinerary-base mapping yet. Choose an appropriate overnight base and confirm transfers before planning a visit."
              : "A place to stay overnight, with its own local stops."}
          </p>
        </div>
        {place.image && (
          <figure>
            <img src={place.image.src} alt={place.image.alt} />
            <figcaption>
              <a href={place.image.creditUrl}>Photo source & reuse license ↗</a>
            </figcaption>
          </figure>
        )}
      </div>
      <div className="discovery-detail-grid">
        <section className="paper-note">
          <h2>
            Practical <em>notes.</em>
          </h2>
          {place.directory && (
            <>
              <p>
                <strong>Browsing destination:</strong>{" "}
                {place.directory.destination_group}
              </p>
              <p>
                <strong>City / municipality:</strong>{" "}
                {place.directory.city_municipality}{" "}
                <SourceIndicator
                  source={place.directory.sources.municipality}
                  label="Municipality"
                />
              </p>
              <p>
                <strong>Province:</strong>{" "}
                {place.directory.province ||
                  "No province assigned (independent city)"}{" "}
                ? <strong>Region:</strong> {place.directory.region}
              </p>
              <p>
                <strong>Barangay:</strong>{" "}
                {place.directory.barangay || "Not verified"}
              </p>
              <p>
                <strong>Address:</strong>{" "}
                {place.directory.address ||
                  "Street or venue address not verified"}{" "}
                <SourceIndicator
                  source={place.directory.sources.address}
                  label="Address"
                />
              </p>
            </>
          )}
          {notes ? (
            <>
              <p>
                <strong>Entry price:</strong>{" "}
                {notes.entryPrice.amount === null
                  ? "Unknown. Check with the venue."
                  : `${peso(notes.entryPrice.amount)} per ${notes.entryPrice.basis}`}{" "}
                <SourceIndicator
                  source={notes.entryPrice.source}
                  label="Entry price"
                />
              </p>
              <p>
                <strong>Planning type:</strong>{" "}
                {notes.mode === "local"
                  ? "Local visit"
                  : notes.mode === "package"
                    ? "Full-day package"
                    : notes.mode === "separate-base"
                      ? "Separate overnight-base planning required"
                    : "Separate excursion"}
                .{" "}
                {notes.mode === "separate-base"
                  ? "Choose an appropriate overnight base and confirm connections before planning this visit. "
                  : notes.mode !== "local"
                  ? "Reserve a full day including transfers. "
                  : "Allow at least 45 minutes between visits; actual travel time needs confirmation. "}
                {notes.componentOf.length > 0 &&
                  "Visit through a suitable package; this component cannot be added independently."}
                {notes.scheduling === "manual" &&
                  "Venue or route details need a fresh check; automatic scheduling and additions are paused."}
              </p>
              {notes.includes.length > 0 && (
                <p>
                  <strong>Package components:</strong>{" "}
                  {notes.includes
                    .map(
                      (id) => base?.stops.find((s) => s.id === id)?.name || id,
                    )
                    .join(", ")}
                  . Operator itineraries and inclusions need confirmation. Do
                  not budget these as extra independent visits.
                </p>
              )}
              <p>
                <strong>Booking:</strong> {notes.booking}{" "}
                <SourceIndicator
                  source={notes.sources.booking}
                  label="Booking"
                />
              </p>
              <p>
                <strong>Visit allowance:</strong> {peso(notes.cost)} per{" "}
                {notes.costBasis}{" "}
                <SourceIndicator source={notes.sources.price} label="Price" />.
                This is an illustrative allowance, not a quoted fee; zero does
                not establish free admission.
              </p>
              <p>
                <strong>Visit duration:</strong> about {notes.minutes} minutes{" "}
                <SourceIndicator
                  source={notes.sources.schedule}
                  label="Duration"
                />
              </p>
              <p>
                <strong>Opening hours:</strong>{" "}
                {notes.openingHours
                  ? `${notes.openingHours.weekdays.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ")} · ${notes.openingHours.opens}–${notes.openingHours.closes}`
                  : "Unknown. Check with the venue."}{" "}
                <SourceIndicator
                  source={notes.openingHours?.source || unverifiedSource()}
                  label="Opening hours"
                />
              </p>
              <p>
                <strong>Accessibility:</strong> {notes.accessibility}{" "}
                <SourceIndicator
                  source={notes.sources.accessibility}
                  label="Accessibility"
                />
              </p>
              <p>
                <strong>Local transport:</strong> {notes.transport}{" "}
                <SourceIndicator
                  source={notes.sources.transport}
                  label="Local transport"
                />
              </p>
              <p>
                <strong>Location:</strong> {notes.locationDetails}{" "}
                <SourceIndicator
                  source={notes.sources.location}
                  label="Location"
                />
              </p>
            </>
          ) : (
            <>
              <p>
                {base?.transport ||
                  "No itinerary transport route is recorded. Confirm access and local travel arrangements."}{" "}
                {base && (
                  <SourceIndicator
                    source={base.sources.transport}
                    label="Transport"
                  />
                )}
              </p>
              {base && (
                <Link className="text-link" href={`/destinations/${base.slug}`}>
                  Full destination guide ↗
                </Link>
              )}
              {place.directory && (
                <p>
                  Entry price, visit duration, opening hours and accessibility
                  are not recorded for this directory-only location. Confirm
                  them with the venue.
                </p>
              )}
            </>
          )}
        </section>
        <section className="paper-note">
          <h2>
            Behind this <em>discovery.</em>
          </h2>
          <p>
            <strong>Catalog discovery</strong> · {place.platform}
          </p>
          <p>{place.supports}</p>
          <SourceIndicator source={place.source} label="Description" />
          <p>
            {place.reviewedOn
              ? `Reviewed ${dayLabel(place.reviewedOn)}`
              : "No review date recorded for this description"}
            {place.reviewExpiresOn
              ? ` · review due ${dayLabel(place.reviewExpiresOn)}`
              : ""}
            .
          </p>
          {reviewExpired(place) && (
            <p>
              Review needs updating; adding this place is paused until it is
              reviewed.
            </p>
          )}
          {place.originalPostUrl && (
            <p>
              <a href={place.originalPostUrl} target="_blank" rel="noreferrer">
                Open original post or video ↗
              </a>
            </p>
          )}
          <SourceReviewNote />
        </section>
      </div>
      <section className="discovery-section">
        <h2>
          A place on <em>the map.</em>
        </h2>
        {point ? (
          <>
            <p>
              Reviewed reference coordinates: {point.lat}, {point.lng}{" "}
              <SourceIndicator source={point.source} label="Coordinates" />. Not
              a surveyed entrance or a routed journey.
            </p>
            {showMap ? (
              <Suspense fallback={<p>Opening map…</p>}>
                <TripMap
                  activities={[mapActivity]}
                  slug={place.baseSlug}
                  center={[point.lat, point.lng]}
                  selected=""
                  onSelect={() => {}}
                />
              </Suspense>
            ) : (
              <button
                className="button secondary"
                disabled={!interactive}
                onClick={() => setShowMap(true)}
              >
                Show location map
              </button>
            )}
          </>
        ) : (
          <p>
            No coordinate pin is available for this place. Approximate or
            unverified catalog pins are not used for nearby distance
            calculations.
          </p>
        )}
      </section>
      <section className="discovery-section">
        <h2>
          While you're <em>nearby.</em>
        </h2>
        <p>
          Only reviewed pins within 15 km of this place are included. Distances
          are straight-line estimates, not road distance or travel time.
        </p>
        <div className="discovery-grid">
          {nearby.spots.map(({ place, km }) => (
            <PlaceCard
              key={place.id}
              place={place}
              distance={km}
              onAdd={onAdd}
            />
          ))}
        </div>
        {!nearby.spots.length && (
          <p className="discovery-empty">
            No nearby discoveries with verified coordinates and a compatible
            local base are available. Places elsewhere are not labeled nearby.
          </p>
        )}
      </section>
    </>
  );
}

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
  verifiedPlaceCoordinates,
  type DiscoveryPlace,
} from "@/lib/discovery";
import { destination, peso } from "@/lib/destinations";
import { blankActivity } from "@/lib/engine";
import {
  interestFresh,
  signalLabel,
  interestCaveat,
  type ReadershipRow,
} from "@/lib/discovery-interest";
import { SourceIndicator, SourceReviewNote } from "./source-indicator";
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
  const base = destination(place.baseSlug)!;
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
          {base.name}
          {base.province ? ` / ${base.province}` : ""} · {place.category}
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
              : "Selected discovery"}
          </span>
          <a href={place.source.sourceUrl!} target="_blank" rel="noreferrer">
            {place.source.sourceName} ↗
          </a>
          <time dateTime={place.reviewedOn}>
            Reviewed {dayLabel(place.reviewedOn)}
          </time>
          {reviewExpired(place) && <span>Review needs updating</span>}
        </div>
        <div className="discovery-actions">
          <Link
            className="text-link"
            href={`/planner?destinations=${place.baseSlug}`}
          >
            Plan a trip here <ArrowUpRight size={14} />
          </Link>
          {place.kind === "spot" && onAdd && (
            <button
              className="text-link plain-button"
              disabled={reviewExpired(place)}
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
    [category, setCategory] = useState("all");
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
  const categories = [
    ...new Set(discoveryPlaces.map((p) => p.category)),
  ].sort();
  const provinces = [
    ...new Set(
      bases
        .map((p) => destination(p.baseSlug)?.province)
        .filter((p): p is string => !!p),
    ),
  ];
  const matches = (p: DiscoveryPlace) => {
    const d = destination(p.baseSlug)!;
    return (
      (area === "all" ||
        area === `base:${p.baseSlug}` ||
        area === `province:${d.province}`) &&
      (category === "all" || category === p.category) &&
      `${p.name} ${d.name} ${d.province || ""} ${p.category} ${p.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  };
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Destination or province
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="all">All reviewed areas</option>
                {provinces.map((p) => (
                  <option key={p} value={`province:${p}`}>
                    {p} · province group
                  </option>
                ))}
                {bases.map((p) => (
                  <option key={p.id} value={`base:${p.baseSlug}`}>
                    {p.name} · overnight base
                  </option>
                ))}
              </select>
            </label>
            <label>
              Place category
              <select
                aria-label="Place category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All place categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
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
            <span className="eyebrow">02 / SELECTED DISCOVERIES</span>
            <h2 id="spots-title">
              Spots to <em>discover.</em>
            </h2>
            <p>
              Reviewed location ideas, with sources and practical details you
              can check. Selection is editorial; it is not a popularity ranking.
            </p>
            <div className="discovery-grid">
              {discoveryPlaces
                .filter((p) => p.kind === "spot" && matches(p))
                .map((p) => (
                  <PlaceCard key={p.id} place={p} onAdd={setAdding} />
                ))}
            </div>
            {!discoveryPlaces.some((p) => p.kind === "spot" && matches(p)) && (
              <p className="discovery-empty">
                No reviewed spots match. Try another area or category.
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
              {bases.filter(matches).map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </div>
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
                    <option key={p.id} value={p.baseSlug}>
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
  const base = destination(place.baseSlug)!;
  const stop = discoveryStop(place);
  const point = verifiedPlaceCoordinates(place);
  const nearby = nearbyDiscoveries(place.baseSlug, place.id);
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
            {base.name} / {place.category}
          </span>
          <h1 className="page-title">{place.name}</h1>
          <p className="lede">{place.description}</p>
          <SourceIndicator source={place.source} label="Description" />
          <p className="discovery-reason">{place.reason}</p>
          <div className="discovery-actions">
            <Link
              className="button"
              href={`/planner?destinations=${place.baseSlug}`}
            >
              Plan a trip here <ArrowUpRight size={16} />
            </Link>
            {stop && (
              <button
                className="button secondary"
                disabled={!interactive || reviewExpired(place)}
                onClick={() => onAdd(place.id)}
              >
                Add to my trip
              </button>
            )}
          </div>
          <p className="fine-print">
            {place.kind === "spot"
              ? `Visit while staying in ${base.name}. Adding this stop does not select a new overnight base.`
              : "A place to stay overnight, with its own local stops."}
          </p>
        </div>
        {place.image && (
          <figure>
            <img src={place.image.src} alt={place.image.alt} />
            <figcaption>
              <a href={place.image.creditUrl}>
                Photo source & reuse license ↗
              </a>
            </figcaption>
          </figure>
        )}
      </div>
      <div className="discovery-detail-grid">
        <section className="paper-note">
          <h2>
            Practical <em>notes.</em>
          </h2>
          {stop ? (
            <>
              <p>
                <strong>Visit allowance:</strong> {peso(stop.cost)} per person{" "}
                <SourceIndicator source={stop.sources.price} label="Price" />.
                This is an illustrative allowance, not a quoted fee; zero does
                not establish free admission.
              </p>
              <p>
                <strong>Visit duration:</strong> about {stop.minutes} minutes{" "}
                <SourceIndicator
                  source={stop.sources.schedule}
                  label="Duration"
                />
              </p>
              <p>
                <strong>Opening hours:</strong>{" "}
                {stop.openingHours
                  ? `${stop.openingHours.weekdays.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ")} · ${stop.openingHours.opens}–${stop.openingHours.closes}`
                  : "Unknown; confirm with the venue."}{" "}
                <SourceIndicator
                  source={stop.openingHours?.source || stop.sources.booking}
                  label="Opening hours"
                />
              </p>
              <p>
                <strong>Accessibility:</strong> {stop.accessibility}{" "}
                <SourceIndicator
                  source={stop.sources.accessibility}
                  label="Accessibility"
                />
              </p>
              <p>
                <strong>Local transport:</strong> {stop.transport}{" "}
                <SourceIndicator
                  source={stop.sources.transport}
                  label="Local transport"
                />
              </p>
              <p>
                <strong>Location:</strong> {stop.locationDetails}{" "}
                <SourceIndicator
                  source={stop.sources.location}
                  label="Location"
                />
              </p>
            </>
          ) : (
            <>
              <p>
                {base.transport}{" "}
                <SourceIndicator
                  source={base.sources.transport}
                  label="Transport"
                />
              </p>
              <Link className="text-link" href={`/destinations/${base.slug}`}>
                Full destination guide ↗
              </Link>
            </>
          )}
        </section>
        <section className="paper-note">
          <h2>
            Behind this <em>discovery.</em>
          </h2>
          <p>
            <strong>Selected discovery</strong> · {place.platform}
          </p>
          <p>{place.supports}</p>
          <a href={place.source.sourceUrl!} target="_blank" rel="noreferrer">
            {place.source.sourceName} ↗
          </a>
          <p>
            Reviewed{" "}
            <time dateTime={place.reviewedOn}>
              {dayLabel(place.reviewedOn)}
            </time>
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
            No verified coordinate pin is available for this place. Approximate
            or unverified catalog pins are not used for nearby distance
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
            No nearby discoveries with verified coordinates are available yet.
          </p>
        )}
      </section>
    </>
  );
}

"use client";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { DiscoveryPlace } from "@/lib/discovery";
import { placeCoordinates } from "@/lib/discovery";
import { blankActivity } from "@/lib/engine";
import {
  googleMapsEmbedUrl,
  googleMapsTarget,
  mapsEmbedConfig,
  type GoogleMapsTarget,
} from "@/lib/google-maps";
import { SourceIndicator } from "./source-indicator";

const TripMap = lazy(() => import("./trip-map"));
const subscribe = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

function GoogleMap({ target }: { target: GoogleMapsTarget }) {
  // These are intentionally browser-visible, build-time values, unlike OAuth
  // and database secrets. Restrict the key to Maps Embed API and HTTP referrers.
  const config = mapsEmbedConfig(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_ENABLED,
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY,
  );
  const src = googleMapsEmbedUrl(target, config);
  const interactive = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const loadButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!requested) return;
    const timer = setTimeout(() => setWaiting(true), 12000);
    return () => clearTimeout(timer);
  }, [requested, attempt]);
  if (!src)
    return (
      <p className="fine-print">
        Use the Google Maps links to find this place and confirm its entrance.
      </p>
    );
  function load() {
    setFailed(false);
    setWaiting(false);
    setRequested(true);
    setAttempt((n) => n + 1);
  }
  return (
    <div className="place-google-map">
      <p className="fine-print">
        Loading the map connects to Google, which receives your IP address and
        may use cookies. You can use the links instead.
      </p>
      <div className="discovery-actions">
        <button
          ref={loadButton}
          className="button secondary"
          disabled={!interactive}
          onClick={load}
        >
          {requested ? "Reload Google map" : "Load Google map"}
        </button>
        {requested && (
          <button
            className="text-link"
            onClick={() => {
              setRequested(false);
              loadButton.current?.focus();
            }}
          >
            Hide Google map
          </button>
        )}
      </div>
      {requested && !failed && (
        <iframe
          key={attempt}
          className="place-google-map-frame"
          title={`Google Maps ${target.mode === "search" ? "search results" : "reviewed place"}: ${target.query}`}
          src={src}
          width="760"
          height="380"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onErrorCapture={() => setFailed(true)}
        />
      )}
      {requested && (
        <p role="status" className="fine-print">
          {failed
            ? "Google Maps could not be loaded. Use Open in Google Maps or try loading again."
            : waiting
              ? "If the map is blank, blocked or shows an error, use Open in Google Maps or try loading again."
              : "Google map requested. If it does not appear, use Open in Google Maps."}
        </p>
      )}
    </div>
  );
}

export function PlaceLocationMap({ place }: { place: DiscoveryPlace }) {
  const target = googleMapsTarget(place);
  const point = placeCoordinates(place);
  const interactive = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [showMap, setShowMap] = useState(false);
  const activity = useMemo(
    () => ({
      ...blankActivity(place.name),
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    }),
    [place.name, point?.lat, point?.lng],
  );
  return (
    <section
      className="discovery-section place-location"
      aria-labelledby="place-location-title"
    >
      <h2 id="place-location-title">
        A place on <em>the map.</em>
      </h2>
      <p>
        {target.reviewed ? (
          <>
            Google place match reviewed {target.reviewed.checkedOn}.{" "}
            <a
              href={target.reviewed.evidenceUrls[0]}
              target="_blank"
              rel="noreferrer"
            >
              Match source ↗
            </a>{" "}
            Check the entrance and current access before travelling.
          </>
        ) : (
          <>
            Find {place.name}
            {target.municipality ? ` in ${target.municipality}` : ""} on Google
            Maps. Search results are not a reviewed location match; confirm the
            name, branch and entrance before following directions.
          </>
        )}
      </p>
      <div className="discovery-actions place-map-links">
        <a
          className="button secondary"
          href={target.searchUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open in Google Maps ↗
        </a>
        <a
          className="button secondary"
          href={target.directionsUrl}
          target="_blank"
          rel="noreferrer"
        >
          Get directions ↗
        </a>
      </div>
      <GoogleMap key={place.id} target={target} />
      {point ? (
        <div className="place-catalog-map">
          <p>
            {point.source.status === "verified"
              ? "Reviewed catalog coordinates"
              : "Approximate catalog coordinates"}
            : {point.lat}, {point.lng}{" "}
            <SourceIndicator source={point.source} label="Coordinates" />. Not a
            surveyed entrance or a routed journey.
            {point.source.status !== "verified" &&
              " These coordinates are not used for Google search centering or nearby distances."}
          </p>
          {showMap ? (
            <Suspense fallback={<p>Opening map…</p>}>
              <TripMap
                activities={[activity]}
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
        </div>
      ) : (
        <p className="fine-print">
          No reviewed catalog coordinate pin yet. Google Maps searches use the
          place name and municipality; nearby distances remain unavailable
          without verified coordinates.
        </p>
      )}
    </section>
  );
}

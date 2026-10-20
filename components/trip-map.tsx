"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";
import type { Activity } from "@/lib/trip";
import { destinationCenter, activityLocation } from "@/lib/map-locations";
export default function TripMap({
  activities,
  slug,
  center,
  selected,
  onSelect,
}: {
  activities: Activity[];
  slug: string | null;
  center?: [number,number];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layer = useRef<LayerGroup | null>(null),
    markers = useRef(new Map<string, Marker>());
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const click = useRef(onSelect);
  useEffect(() => { click.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        map.current = L.map(container.current, {
          scrollWheelZoom: false,
        }).setView(center || destinationCenter(slug!), 12);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          },
        ).addTo(map.current);
        tiles.on("tileerror", () =>
          setError("Some map tiles could not load. Location links still work."),
        );
        layer.current = L.layerGroup().addTo(map.current);
        setReady(true);
      })
      .catch(() =>
        setError("Map unavailable. Use the location links in your itinerary."),
      );
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [slug]);
  useEffect(() => {
    if (!ready || !map.current || !layer.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();
      markers.current.clear();
      const points: [number, number][] = [];
      activities.forEach((a, i) => {
        const p = activityLocation(a);
        if (!p) return;
        points.push(p);
        const icon = L.divIcon({
          html: `<span class="map-pin">${i + 1}</span>`,
          className: "numbered-pin",
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        const marker = L.marker(p, {
          icon,
          title: a.name,
          keyboard: true,
        }).addTo(layer.current!);
        const popup = document.createElement("span");
        popup.textContent = a.name;
        marker.bindPopup(popup);
        marker.on("click", () => click.current(a.id));
        markers.current.set(a.id, marker);
      });
      if (points.length)
        map.current.fitBounds(L.latLngBounds(points).pad(0.25), {
          maxZoom: 14,
        });
      else {
        map.current.setView(center || destinationCenter(slug!), 12);
      }
      map.current.invalidateSize();
      const focused=markers.current.get(selected);
      if(focused){map.current.panTo(focused.getLatLng());focused.openPopup();}
    });
    return () => {
      cancelled = true;
    };
  }, [activities, slug, ready, selected]);
  useEffect(() => {
    const marker = markers.current.get(selected);
    if (marker && map.current) {
      map.current.panTo(marker.getLatLng());
      marker.openPopup();
    }
  }, [selected]);
  return (
    <div className="map-wrap">
      <div
        ref={container}
        className="trip-map"
        aria-label="Interactive destination map"
      />
      {error && (
        <p role="status" className="fine-print">
          {error}
        </p>
      )}
      <p className="map-caption">
        Approximate stop locations. No verified road or marine route is drawn.
      </p>
    </div>
  );
}

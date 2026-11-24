"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Binoculars,
  Coffee,
  Croissant,
  Fish,
  Flower2,
  Landmark,
  Mountain,
  Soup,
  Store,
  Sun,
  Ticket,
  Trees,
  Utensils,
  Waves,
} from "lucide-react";
import { coverChoices, illustrationFor } from "@/lib/catalog/place-covers";
import type { DiscoveryPlace } from "@/lib/discovery";
import { PlaceImage } from "./place-media";

const styles = {
  cafe: { Primary: Coffee, Detail: Croissant, alt: "a coffee cup and pastry" },
  dining: { Primary: Soup, Detail: Utensils, alt: "a bowl and cutlery" },
  coast: { Primary: Waves, Detail: Fish, alt: "waves and a fish" },
  park: { Primary: Trees, Detail: Flower2, alt: "trees and a flower" },
  heritage: {
    Primary: Landmark,
    Detail: Ticket,
    alt: "a museum symbol and a ticket",
  },
  nature: { Primary: Mountain, Detail: Sun, alt: "mountains and the sun" },
  market: {
    Primary: Store,
    Detail: Flower2,
    alt: "a market stall and a flower",
  },
  attraction: {
    Primary: Binoculars,
    Detail: Sun,
    alt: "binoculars and the sun",
  },
};

const coverLabels = {
  promotion: "Promotional image",
  logo: "Business logo",
  illustration: "Illustration",
};

export function PlaceCover({
  place,
  card = false,
  onPhotoError,
  choices = coverChoices(place),
}: {
  place: DiscoveryPlace;
  card?: boolean;
  onPhotoError?: () => void;
  choices?: ReturnType<typeof coverChoices>;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const cover = choices.find(({ image }) => !failed.has(image.src));
  const kind = cover?.kind ?? "illustration";
  const style = illustrationFor(place);
  const { Primary, Detail, alt } = styles[style];
  const media = (
    <div className="place-cover-frame" data-cover-kind={kind}>
      {cover ? (
        <PlaceImage
          key={cover.image.src}
          image={
            cover.kind === "photo"
              ? cover.image
              : { ...cover.image, objectPosition: "50% 50%" }
          }
          prominent={!card}
          onError={() => {
            setFailed((previous) =>
              previous.has(cover.image.src)
                ? previous
                : new Set([...previous, cover.image.src]),
            );
            if (cover.kind === "photo") onPhotoError?.();
          }}
        />
      ) : (
        <div
          className="place-cover-art place-photo-fallback"
          data-illustration={style}
          role="img"
          aria-label={`Category illustration of ${alt}`}
        >
          <div className="place-cover-drawing" aria-hidden="true">
            <Primary className="place-cover-primary" strokeWidth={1.55} />
            <Detail className="place-cover-detail" strokeWidth={1.55} />
          </div>
        </div>
      )}
      {kind !== "photo" && (
        <span className="place-cover-label">{coverLabels[kind]}</span>
      )}
    </div>
  );

  if (card)
    return (
      <>
        <Link
          href={`/discover/${place.id}`}
          aria-label={`View ${place.name}`}
          className="discovery-photo"
        >
          {media}
          <span className="discovery-kind">
            {place.kind === "base" ? "Overnight base" : "Individual stop"}
          </span>
        </Link>
        {cover && cover.kind !== "photo" && (
          <div className="cover-card-credit">
            <a href={cover.image.creditUrl} target="_blank" rel="noreferrer">
              {cover.image.attribution}
            </a>
          </div>
        )}
      </>
    );

  return (
    <figure className="place-cover">
      {media}
      {cover && (
        <figcaption>
          {cover.kind === "photo" ? (
            <a href="#place-sources">Photo source and reuse license</a>
          ) : (
            <>
              {cover.image.attribution} ·{" "}
              <a href={cover.image.creditUrl} target="_blank" rel="noreferrer">
                Original source
              </a>{" "}
              ·{" "}
              <a href={cover.image.licenseUrl} target="_blank" rel="noreferrer">
                Reuse terms
              </a>
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}

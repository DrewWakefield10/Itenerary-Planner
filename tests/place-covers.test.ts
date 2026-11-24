import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  coverChoices,
  illustrationFor,
  supplementalCoverSchema,
} from "../lib/catalog/place-covers";
import { discoveryPlace } from "../lib/discovery";
import { PlaceCover } from "../components/place-cover";

const place = discoveryPlace("siargao-spotted-pig-catangnan")!;
const image = {
  placeId: place.id,
  src: "/images/place-covers/fixture.png",
  sourcePage: "https://example.test/press/fixture",
  originalUrl: "https://example.test/press/fixture.png",
  creator: "Fixture photographer",
  license: "Example rights grant",
  licenseUrl: "https://example.test/press/terms",
  attribution: "Fixture image credit",
  alt: "Fixture asset for automated tests",
  width: 640,
  height: 320,
  checkedOn: "2026-10-01",
};
const supplemental = {
  kind: "promotion",
  asset: image,
  rightsEvidence:
    "Fixture grant covers display and proportional resizing in a public directory.",
  directoryUseAllowed: true,
  resizingAllowed: true,
};
const promotion = supplementalCoverSchema.parse(supplemental);
const logo = supplementalCoverSchema.parse({
  ...supplemental,
  kind: "logo",
  asset: { ...image, src: "/images/place-covers/logo.png" },
});

test("covers prefer an existing photograph, then a rights-cleared graphic and logo", () => {
  const existing = {
    ...place,
    image: {
      ...image,
      src: "/images/places/test.jpg",
      creditUrl: image.sourcePage,
    },
  };
  assert.deepEqual(
    coverChoices(existing, [logo, promotion]).map((cover) => cover.kind),
    ["photo", "promotion", "logo"],
  );
  assert.deepEqual(
    coverChoices(place, [logo, promotion]).map((cover) => cover.kind),
    ["promotion", "logo"],
  );
  assert.equal(
    coverChoices({ ...place, id: "another-branch" }, [logo, promotion]).length,
    0,
  );
  assert.equal(
    supplementalCoverSchema.safeParse({
      ...supplemental,
      directoryUseAllowed: false,
    }).success,
    false,
  );
  assert.equal(
    supplementalCoverSchema.safeParse({
      ...supplemental,
      resizingAllowed: false,
    }).success,
    false,
  );
  for (const src of [
    "https://cdn.example.test/unreviewed.png",
    "/images/place-covers/../../unreviewed.png",
  ]) {
    assert.equal(
      supplementalCoverSchema.safeParse({
        ...supplemental,
        asset: { ...image, src },
      }).success,
      false,
    );
  }
  assert.equal(
    supplementalCoverSchema.safeParse({
      ...supplemental,
      asset: {
        ...image,
        originalUrl: "https://scontent.cdninstagram.com/reused.png",
      },
    }).success,
    false,
  );
});

test("every visual kind renders with the correct status and independent credits", () => {
  const photo = renderToStaticMarkup(
    createElement(PlaceCover, {
      place: discoveryPlace("baguio-burnham-park")!,
    }),
  );
  assert.match(photo, /data-cover-kind="photo"/);
  assert.match(photo, /Photo source and reuse license/);

  for (const [record, label] of [
    [promotion, "Promotional image"],
    [logo, "Business logo"],
  ] as const) {
    const markup = renderToStaticMarkup(
      createElement(PlaceCover, {
        place,
        choices: coverChoices(place, [record]),
      }),
    );
    assert.match(markup, new RegExp(`data-cover-kind="${record.kind}"`));
    assert.ok(
      markup.includes(label) &&
        markup.includes(image.licenseUrl) &&
        markup.includes(image.sourcePage),
    );
  }

  const artwork = renderToStaticMarkup(
    createElement(PlaceCover, { place, choices: [] }),
  );
  assert.match(artwork, /data-cover-kind="illustration"/);
  assert.match(artwork, /Category illustration of a coffee cup and pastry/);
  assert.equal(
    illustrationFor({ id: "demo", name: "Sample Beach", category: "Nature" }),
    "coast",
  );
  assert.equal(
    illustrationFor({
      id: "demo",
      name: "Sample Park",
      category: "Parks & markets",
    }),
    "park",
  );
});

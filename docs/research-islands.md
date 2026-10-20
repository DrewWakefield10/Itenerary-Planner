# Island and Davao catalog research

Reviewed 19 October 2026 for the Lakbay seed expansion. The accompanying `lib/catalog/research-islands.json` contains additions only; it does not replace or migrate the legacy `palawan` destination. Generic meal breaks, town strolls, and duplicate names are excluded from the distinct-place counts below.

| Overnight base | New named places | Package records, counted separately | Existing named places to retain | Approximate distinct-place coverage after integration |
| --- | ---: | ---: | --- | ---: |
| El Nido | 16 | 4 | Corong Corong Beach, Lio Beach, Big Lagoon | 19 |
| Coron town on Busuanga | 15 | 5 | Lualhati Park, Mount Tapyas | 17 |
| Puerto Princesa city proper | 12 | 0 | Plaza Cuartel, Immaculate Conception Cathedral, Baywalk | 15 |
| Siargao / General Luna | 13 | 1 | Cloud 9, General Luna Market | 15 |
| Davao City | 15 | 0 | People's Park, San Pedro Cathedral, Museo Dabawenyo | 18 |

The Siargao Catangnan Bridge record may refine the existing generic “Catangnan coastal afternoon”; do not count that older generic activity as another named attraction. Existing broad town walks can remain compatible without inflating catalog coverage.

## Evidence and unknowns

Evidence is scoped to listed fields. A reviewed attraction name or location does not verify admission, opening, accessibility, transfer duration, or availability. Every new admission price is `null`, with `costBasis: "unknown"`; unknown admission must not become a zero-price claim. The existing generator may provide separately labeled illustrative allowances.

All durations are Lakbay planning estimates, not published travel times or promised visit lengths. Excursion durations reserve room for transfers. Only Eden Nature Park has structured opening hours here, taken from the operator's resort hours; these differ from its city reservations-office hours. Confirm current operation before visiting. No new accessibility claim is verified.

Six records have sourced reference pins: Nacpan Beach, Maremegmeg Beach, Kayangan Lake, Mendoza Park, Daku Island, and Philippine Eagle Center. Coordinates remain labeled estimates because these are dataset reference points rather than surveyed entrances. Remaining 75 records, including packages, have null coordinates. Do not substitute the overnight base's center as a spot pin. Mendoza and Daku decimal values are direct degree/minute/second conversions without invented accuracy.

Coordinate references:

- [Nacpan / OpenStreetMap way 576119742](https://mapcarta.com/W576119742)
- [Maremegmeg / OpenStreetMap node 12506433601](https://mapcarta.com/N12506433601)
- [Kayangan Lake / Wikipedia](https://en.wikipedia.org/wiki/Kayangan_Lake)
- [Mendoza Park / Wikidata Q55507340](https://www.wikidata.org/wiki/Q55507340)
- [Daku Island / Wikidata Q16555043 and Geographic Names Server](https://www.wikidata.org/wiki/Q16555043)
- [Philippine Eagle Center / OpenStreetMap node 747886405](https://mapcarta.com/N747886405)

Guyam's Wikidata coordinate was not used: its low-precision position differed materially from other island-map references. NMP-Davao's available encyclopedia pin was also not adopted without stronger entrance-level corroboration. Broader coordinate completion is an identified research gap.

## Packages and travel geography

Marine components have `componentOf` package IDs. Their names can be browsed, but the generator must schedule a package once, not schedule or price each component in addition. A package's `includes` lists the researched catalog components, not a guaranteed complete operator itinerary. Specific routes, permits, sailing decisions, equipment, and inclusions require a current operator confirmation.

- [Discover El Nido's Tour A](https://www.discoverelnido.com/tours/tour-a/), [Tour B](https://www.discoverelnido.com/tours/tour-b/), [Tour C](https://www.discoverelnido.com/tours/tour-c/), and [Tour D](https://www.discoverelnido.com/tours/tour-d/) provide separate route evidence. Existing Big Lagoon is `el-nido-big-lagoon` and belongs to Tour A. Nacpan, Duli, and Nagkalit-kalit are mainland excursions; they are not assumed nearby town stops or extra stops on a marine package. Maremegmeg's common Las Cabañas naming is retained as an alias; the map point is a beach reference, not a precise entrance.
- [I Capture Travel's Coron routes](https://www.corontravel.com/coron) establish named boat-tour components. The lake/lagoon, C1, C2, Reef and Wrecks, and Tour A packages are distinct choices. Malcapuya and Kayangan can belong to more than one route, so cross-package duplication must also be prevented. Offshore Coron Island is not the overnight town on Busuanga. No normal city-day road access is implied for those offshore spots.
- [Puerto Princesa City Tourism's destination map](https://citytourism.puertoprincesa.ph/destination-map/), [historical landmarks](https://citytourism.puertoprincesa.ph/historical-landmarks/), and [community destinations](https://citytourism.puertoprincesa.ph/cbst-destinations/) support the city catalog. Sabang's Underground River, Tagabinet's Ugong Rock, and Buenavista's viewpoint require separate excursions from city proper. Iwahig firefly watching is an evening outing requiring separate return arrangements. The [park's January 2026 advisory](https://undergroundriver.puertoprincesa.ph/travel-advisory/travel-advisory-2/) explicitly requires a permit and identification; this is the sole new `requiresBooking: true` record. An older city tourism page conflicts on office location and fees, so no ticket quote or booking-office address is asserted.
- [Tourism Promotions Board's PHITEX 2024 itinerary](https://www.tpb.gov.ph/wp-content/uploads/2024/07/ITINERARY-PHITEX2024.pdf) supports the Naked–Daku–Guyam grouping. [Javalava's operator routes](https://www.gojavalava.com/siargaotours) and the [DOT London Siargao brochure](https://itsmorefuninthephilippines.co.uk/wp-content/uploads/PDOTL_Siargao_Web.pdf) support inland and northern destinations. The brochure is older descriptive evidence, not current operating information. Pacifico, Alegria, Taktak Falls, and Santa Monica Pier are distant outings from General Luna; repeat visits may justify another overnight base, but this change creates none. Sugba requires road plus boat arrangements. The [Pilar advisory reported by PNA](https://www.pna.gov.ph/articles/1267976) establishes that Magpupungko has managed closure periods; a past closure is not a claim that it is currently closed or open.
- Davao's Malagos, Calinan, and Toril attractions are separate road excursions. The [Eden operator page](https://www.edennaturepark.com.ph/), [Philippine Eagle Foundation](https://www.philippineeaglefoundation.org/copy-of-the-pec-1), [Malagos resort address](https://www.malagos.com/contact), and [city IMIN listing](https://tourism.davaocity.gov.ph/explore-the-city/attractions/musuems/imin-philippine-japan-historical-museum/) identify the correct areas. Davao's Baguio District is not Baguio City. Samal and Mount Apo were deliberately omitted rather than presented as ordinary downtown attractions.

None of the package records claims a mandatory commercial reservation solely because a private operator sells that itinerary. `requiresBooking` is otherwise absent. Confirm access and guides where the text calls for them.

## Davao museums: important catalog correction

The old `Museo Dabawenyo area` seed pin is around San Pedro. Preserve historical saved-trip snapshots, but do not treat that old pin as the current entrance. The [City Government's 13 May 2025 article](https://davaocity.gov.ph/local-government/museo-dabawenyo-event-center-opens-exhibit-a-history-of-davao-city-in-50-objects/) identifies the Museo Dabawenyo Event Center at Mabini Street, Barangay 10-A, behind Davao City National High School. It reports Monday–Saturday 08:30–17:30 and free admission, published in 2025; these do not guarantee current availability. A new pin was not invented. The [PIA's Definitely Davao tour report](https://pia.gov.ph/news/davao-city-holds-definitely-davao-tours/) independently describes the Mabini Street location.

The [NMP-Davao official page](https://www.nationalmuseum.gov.ph/nmp-davao/) identifies a separate institution at People's Park Compound, J. Palma Gil Street. Its older fifth-floor reference to Museo Dabawenyo conflicts with the later city location announcement; do not merge the institutions or duplicate the existing Museo as a new place. NMP-Davao's current galleries and opening access require confirmation. Likewise, Davao Museum of History and Ethnography is a third institution: [PIA reported a move to Ateneo's Jacinto campus](https://pia.gov.ph/news/davao-museum-gets-new-home-at-ateneo-de-davao/). It was omitted because a current visitor opening and entrance could not be confirmed.

## Integration checks for the root implementation

- Preserve old stop names through aliases or stable ID mapping. Big Lagoon, Lualhati Park, Mount Tapyas, Cloud 9, and Plaza Cuartel already exist.
- Unknown pins stay absent from maps and distance sorting; no fabricated coordinates.
- Reject scheduling a component alongside its package or a shared component in two packages.
- Excursions need full blocks and must not be placed on arrival, departure, or connection days merely to increase variety.
- Parks, town districts, and markets are genuine named places here; generic meals, package totals, and the same park's internal displays must not inflate coverage.
- A “checked” label dates the source review and does not establish current access or weather suitability.

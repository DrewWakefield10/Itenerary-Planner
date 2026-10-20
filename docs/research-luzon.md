# Luzon catalog research — 19 October 2026

This file records a bounded seed-data research pass. The JSON contains additions only; existing IDs and names are untouched. All descriptions are short original summaries. A source supports only the evidence fields listed on each record. Grouping, visit durations, indoor/outdoor classification, and interests are planning choices, not guarantees from the sources.

| Base | Additions | Existing distinct named places counted | Combined distinct coverage |
| --- | ---: | ---: | ---: |
| Baguio | 11 | 5 | 16 |
| Sagada | 14 | 1 | 15 |
| Manila | 12 | 3 | 15 |
| Batanes / Basco base | 14 | 1 | 15 |

Generic town walks, café breaks, local lunch placeholders, and craft browsing do not count toward these totals. Baguio's existing Public Market counts as a real distinct market. The existing lighthouse, rather than generic Basco streets, is counted for Batanes. No entries are split merely to increase the count.

## Sources reviewed

### Baguio

- [City Government attraction directory](https://infoboard.baguio.gov.ph/tourists-spots) establishes the named venues and listed addresses. Its JavaScript UI did not render in the text browser; the search index exposed the current official directory text. Location evidence does not verify exact coordinates, transport, access, hours, or admission.
- [Museo Kordilyera official site](https://museokordilyera.upb.edu.ph/) identifies the museum's cultural focus. Its [contact page](https://museokordilyera.upb.edu.ph/contact-us/) still contains an old COVID closure statement, so no operating hours or access status were copied.
- [Baguio Mansion House](https://baguiomansionhouse.gov.ph/) explicitly lists free admission, Tuesday–Sunday 09:00–18:00, private-tour reservations, and walk-ins subject to slots. These facts have their own evidence and do not verify accessibility or a pin.
- The existing Leonard Wood cluster is retained for Mansion House. Other Baguio venues remain ordinary local stops under the same overnight base. Distant neighboring municipalities are not included to fill the count.

### Sagada

- [Municipality iPass directory](https://umali-kayo.sagada.gov.ph/) lists the fourteen named natural or cultural destinations.
- [Official tourism home and accredited guide organizations](https://tourism.sagada.gov.ph/) support consulting municipal tourism and accredited guides before arranging routes.
- [Official destination page](https://tourism.sagada.gov.ph/sagada-tourist-sites/) embeds a linked destination application. That application exposed no text to the research browser; no extra access, price, pin, or schedule claims were inferred.
- All added routes are deliberately marked excursions, even where a trail starts near town. Their allowances are estimates for reserving space, not operator itineraries or confirmed total times. Caves and burial sites are not treated as casual unrestricted walk-ins. The fourteen route names represent individual alternatives, not an instruction to schedule all fourteen. Routes that overlap physically must not be combined automatically or treated as independent consecutive local visits.

### Manila

- [Intramuros Administration sites](https://intramuros.gov.ph/sites/) confirms the eight additional Intramuros venues.
- [Administration directory](https://intramuros.gov.ph/sites-museums/), [Museo visitor page](https://intramuros.gov.ph/mdi/), and [Centro booking portal](https://cdti.intramuros.gov.ph/) contain differing access or timetable information. Intramuros hours and prices remain unknown in this pass.
- [National Museum of Fine Arts](https://www.nationalmuseum.gov.ph/our-museums/national-museum-of-fine-arts/), [Anthropology](https://www.nationalmuseum.gov.ph/our-museums/national-museum-of-anthropology/), and [Natural History](https://www.nationalmuseum.gov.ph/our-museums/national-museum-of-natural-history/) establish three separate museum buildings.
- [Official reservation portal](https://reservation.nationalmuseum.gov.ph/) gives the central-complex location and advance-booking rule for groups of 20–150.
- The linked 28 May 2026 National Museum announcement (stored on each museum record) explicitly states free admission and Monday–Sunday 09:00–18:00. That is reviewed evidence, not a promise against later closures.
- [NPDC Paco Park](https://npdc.gov.ph/paco-park/) supports its identity and location. Paco is a separate neighborhood cluster, not another travel base.

### Batanes

- [Department of Tourism Region 2](https://www.region2fun.ph/official/batanes-2/) establishes names and municipality context. Old factual material on this page includes stale hospitality and access details; none were imported as current visitor arrangements. No mountain elevation, travel-time quote, swimming recommendation, or sea-crossing claim was copied.
- [TPB 2025 inspection itinerary](https://tpb.gov.ph/wp-content/uploads/2024/11/Annex-B_Itinerary-Batanes.pdf) confirms named North Batan stops. Its times describe an old organized group itinerary, not a current public tour schedule.
- [Provincial tourism map](https://breathtakingbatanes.com/maps/) was reviewed for context. Its dynamic pins were not accessible as verified coordinates in the research browser.
- Basco has three additional local town stops. More distant Batan Island locations are excursions from the Basco overnight base, with deliberately generous estimated blocks. The cluster does not imply the whole route fits into that allowance. No Sabtang, Itbayat, or other sea crossing is disguised as a local stop.
- Fundacion Pacita is private accommodation: art-viewing access needs operator confirmation. Diura is a working community. Government, home, religious-site, and tunnel access are not assumed from the existence of a listing.

## Unknowns and integration notes

Except for the five reference points in the follow-up below, new exact coordinates remain null because no pin was independently checked from usable evidence. Do not use the overnight-base center as a fabricated attraction pin. All new prices are unknown except the Mansion House and three National Museum admissions explicitly supported above. None of the records establishes step-free accessibility. Except for those four venues, opening hours are unknown. Transport fares, travel times, guide charges, permits, and current route access remain unverified. Visit durations and route clusters are cautious editorial estimates; they need the same estimate labels as other generated schedule facts.

For itinerary generation, an excursion should occupy its own planning block and must not be silently combined with other distant or overlapping routes. In particular, Nabas-Ang/Ampacao and Marlboro/Blue Soil can overlap in operator routes; the JSON supplies alternatives, not packaged inclusions. The source schema allows later evidence for prices, coordinates, hours, or bookings without upgrading adjacent facts.

## Bounded coordinate follow-up - 19 October 2026

Five representative reference points were copied exactly as displayed by their linked Wikimedia sources: Mansion House (16.412222, 120.621389), Sumaguing Cave (17.06673, 120.90297), National Museum of Fine Arts (14.5869, 120.9812), National Museum of Natural History (14.583306, 120.982194), and Tukon Chapel (20.43000, 121.97056). Each affected JSON record links its coordinate source separately.

The building points are Wikipedia reference coordinates, not verified visitor entrances, accessible drop-off points, or navigable routes. The cave point comes from Wikidata Q91479447, displayed by Wikimedia Commons and its linked GeoHack decimal conversion. That Wikidata coordinate statement has no underlying reference; it must not be treated as a cave entrance or meeting point. All five coordinate facts therefore retain estimate status even though the values were checked against the stated reference sources. Other fields, IDs, prices, hours, and booking notes were preserved. Official destination lists established identity separately; these map references do not upgrade transport, access, price, or accessibility.

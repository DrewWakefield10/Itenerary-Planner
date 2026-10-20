# Visayas catalog research

Reviewed on 19 October 2026. This file accompanies `lib/catalog/research-visayas.json`; it supplies additions for integration, not a second independently routable destination catalog.

## Coverage and reuse

| Overnight base slug | Added records | Existing real places reused | Physical places, excluding packages and separate-base options |
| --- | ---: | ---: | ---: |
| `cebu` (Cebu City) | 15 | 3 | 16 |
| `bohol` (Panglao Island) | 14 | 3 | 15 |
| `boracay` | 13 | 3 | 15 |
| `iloilo` (Iloilo City) | 12 | 3 | 15 |

Existing suitable venues are intentionally absent from the JSON: Fort San Pedro, Magellan’s Cross, Casa Gorordo Museum; Alona Beach, Danao Beach, Panglao town plaza; White Beach, D’Mall, Bulabog Beach; Iloilo River Esplanade, Molo Church/plaza, and Jaro plaza. Generic lunch/café placeholders do not count as venues. White Beach Stations 1 and 2 count as one beach, not two additional places.

Record totals include explicitly separated outing ideas. Physical-place counts above exclude package activities and separate-base options. They do not mean all sites fit into an ordinary local day, or establish current opening status. Of 54 additions, 44 are local, five are excursions, four are packages, and one requires separate-base planning.

## Geography and scheduling

- Cebu remains a Cebu **City** overnight base. Sirao, Temple of Leah, and TOPS are upland excursions, with independent road and return planning. Kawasan Falls is a separate Badian excursion; its official June 2026 page reports phased rehabilitation, so current access needs confirmation. Sumilon is an Oslob boat package requiring a separate southern Cebu journey. Moalboal is flagged `separate-base`; do not silently route it as a city stop.
- Bohol remains based on Panglao Island. Panglao and Dauis clusters are local island visits, with transfer durations still unknown. Balicasag is a boat package. Chocolate Hills/Carmen and the Loboc River cruise require independent mainland excursion/package planning.
- Boracay’s ordinary stops are island-local, grouped conservatively by named area. Crocodile Island is a boat package. Balinghai and Newcoast access are not assumed public. The TPB map confirms named-place geography, not current access, current businesses, safe water conditions, or opening status.
- Iloilo uses Molo, Jaro, Capitol, City Proper, and Mandurriao clusters. District changes need local transport buffers. The two food venues identify specific locations: Original Biscocho Haus in Jaro and Baking Studio by Theo’s at North Grove, Molo.

Durations are editorial visit estimates, excluding unknown transfers, queues, and contingencies. No road, trail, swimming, sailing, or opening-time safety determination is made. Package `requiresBooking` flags mean the itinerary must require traveler/operator arrangements; no reservation is made or availability guaranteed.

## Fact-level evidence and unknowns

Eight representative coordinate references were checked, two per base. National Museum Cebu, Temple of Leah, Hinagdanan Cave, Dauis Church, Jaro Cathedral, and National Museum Western Visayas use their Wikipedia page's displayed reference coordinates, with separate `coordinates` evidence. These identify the site, not a separately verified visitor entrance. Puka and Diniwid use named beach monitoring-station coordinates from the official DENR-EMB Region VI 2021 report; their coordinate status is `estimate` because these are approximate visitor beach references rather than access points. The remaining 46 coordinate pairs stay `null`. Do not substitute the overnight-base center as a verified attraction pin.

The Boracay report's indexed table gives Puka Beach as 11 degrees 59 minutes 46.5 seconds N, 121 degrees 54 minutes 57.1 seconds E, and Diniwid Beach as 11 degrees 58 minutes 35.4 seconds N, 121 degrees 54 minutes 42.4 seconds E. JSON stores the decimal-degree conversions. The PDF itself returned HTTP 403, so only the returned indexed table was reviewed. These points do not establish present water quality or swimming suitability.

Follow-up food additions are Common Crew in Tawala and Shaka's Panglao branch, plus Nonie's at Ondus Hotel, Station 3, Boracay. Common Crew's operator pages describe al fresco space, so it is not assumed to provide indoor rain protection. Shaka's operator company profile supports the Panglao branch and lists Ester Lim Road; its main website did not load reliably, so the record requires current-address confirmation. Nonie's own website currently places it at Ondus, replacing older third-party Station X listings; the hotel dining page suggests access restrictions, so confirm dining access directly.

Operational caution: a newly reviewed [Mount Luho travel report](https://www.lakadpilipinas.com/2017/07/mt-luho-view-deck-boracay.html) says its featured viewdeck has closed and describes several separate historical decks. The original Mount Luho record is retained unchanged as requested, with access/operation already unverified. Do not actively recommend it until a current operator confirms the specific viewpoint. Physical-place count is not a count of confirmed operating venues.

All 53 other entry prices are `null`; TOPS regular admission is the sole price, which its official visitor page lists as PHP100 per person. That amount excludes transport and additional activities. The website also describes an IT Park shuttle; no departure schedule, actual availability, or travel time is verified. Market, restaurant, resort-access, boat, permit, and attraction prices remain unknown rather than zero.

Hours, accessibility, booking policies, and precise transfer durations are otherwise unknown. The former Cebu Ocean Park ticket-page subdomain surfaced a 09:00–18:00 snippet, but its page did not load reliably and its current homepage has variable promotional ticket types. No hours or single entry price are copied into the record. No old exhibition dates are reused as regular museum hours.

The JSON evidence `fields` array limits each checked status to its supported facts. A reviewed place description/location does not verify the cost, pin, booking policy, travel time, duration, weather, or accessibility. The literal review date records this research session and must not be advanced by generation.

## Reviewed supporting pages

- [Basilica Minore del Santo Niño — Magellan’s Cross](https://santoninodecebubasilica.org/basilica-minore-del-santo-nino/magellans-cross/)
- [National Museum of the Philippines — Cebu](https://www.nationalmuseum.gov.ph/nmp-cebu-2/)
- [Philippine Department of Tourism — Cebu City](https://philippines.travel/destinations/cebu-city/index)
- [Province of Cebu — Museo Sugbo reopening](https://www.cebu.gov.ph/2383/museo-sugbo-reopens-with-unveiling-of-cultural-property-and-provincial-marker/)
- [Province of Cebu — History and heritage](https://www.cebu.gov.ph/about/)
- [TOPS — official visitor information](https://www.topscebu.ph/)
- [Cebu Ocean Park — official visitor information](https://www.cebuoceanpark.com/)
- [Province of Cebu — Kawasan rehabilitation update](https://www.cebu.gov.ph/13093/gov-pam-kawasan-falls-rehab-to-prioritize-environmental-restoration-not-commercial-development/)
- [Bohol Provincial Tourism Office — Panglao](https://tourism.bohol.gov.ph/visitbohol-panglao/)
- [Bohol Provincial Tourism Office — Dauis](https://tourism.bohol.gov.ph/visitbohol-dauis/)
- [Bohol Provincial Tourism Office — Carmen](https://tourism.bohol.gov.ph/visitbohol-carmen/)
- [Bohol Provincial Tourism Office — Loboc](https://tourism.bohol.gov.ph/visitbohol-loboc/)
- [Tourism Promotions Board — Boracay map (archival place reference)](https://www.tpb.gov.ph/wp-content/uploads/2023/10/Boracay-Map.pdf)
- [Tourism Promotions Board — Boracay information](https://www.tpb.gov.ph/wp-content/uploads/2023/10/Boracay-Information.pdf)
- [Philippine Department of Tourism Australia and New Zealand — Boracay](https://www.tourismphilippines.com.au/where/boracay)
- [Boracay Newcoast — official coves information](https://boracaynewcoastph.com/coves/)
- [Department of Environment and Natural Resources — Wetland 4](https://ncr.denr.gov.ph/news-events/unveiling-of-marker-for-boracays-wetland-4/)
- [Iloilo City Government — Discover Iloilo City](https://iloilocity.gov.ph/discover-iloilo-city/)
- [National Museum of the Philippines — Western Visayas](https://www.nationalmuseum.gov.ph/our-museums/regional-area-and-site-museums/western-visayas/)
- [Iloilo Provincial Government — Casa Real de Iloilo](https://www.iloilo.gov.ph/en/gallery/casa-real-de-iloilo)
- [Iloilo City cultural heritage guide — Calle Real](https://iloilocityinfoapp.site/historical13.php)
- [Iloilo City Government — Comprehensive land use plan, sectoral studies](https://iloilocity.gov.ph/main/wp-content/uploads/2022/06/Vol3_SecStud_IC-2021-2029.pdf)
- [Theo’s Restaurant and Bakery — Baking Studio, North Grove](https://www.theosrestaurantandbakery.com/bakingstudiobytheos)
- [Original Biscocho Haus — official information](https://biscochohaus.com/)
- [Regional Statistics Committee VI — Tourism chapter](https://rsc6.gov.ph/wp-content/uploads/2024/10/WV-RSET-Chapter-8-TOURISM.pdf)

The Bohol Provincial Tourism Office pages and Cebu/City government, museum, operator, TPB, DENR, and regional-government pages above were opened or their indexed page content reviewed during this session. Some archival PDFs could not be fully opened; only their returned named-place text is used, with current access explicitly unknown. The Iloilo cultural heritage guide supplies the Calle Real street-area reference; it is not used for live transit or venue schedules.

## Integration checks to retain

Follow-up reviewed sources (19 October 2026):

- [Wikipedia — National Museum Cebu building reference coordinates](https://en.wikipedia.org/wiki/National_Museum_of_the_Philippines_(Cebu))
- [Wikipedia — Temple of Leah reference coordinates](https://en.wikipedia.org/wiki/Temple_of_Leah)
- [Wikipedia — Hinagdanan Cave reference coordinates](https://en.wikipedia.org/wiki/Hinagdanan_Cave)
- [Wikipedia — Dauis Church reference coordinates](https://en.wikipedia.org/wiki/Dauis_Church)
- [DENR-EMB Region VI — Diniwid Beach monitoring-station reference, not an entrance](https://r6.emb.gov.ph/wp-content/uploads/2023/02/RSOBER-2021-WESTERN-VISAYAS.pdf)
- [Wikipedia — Jaro Cathedral reference coordinates](https://en.wikipedia.org/wiki/Jaro_Cathedral)
- [Wikipedia — National Museum Western Visayas reference coordinates](https://en.wikipedia.org/wiki/National_Museum_Western_Visayas)
- [Common Crew Bohol — coffee and kombucha brew bar](https://www.commoncrewbohol.com/coffee-kombucha-brew-bar)
- [Common Crew Bohol — location and coworking information](https://www.commoncrewbohol.com/coworking-space)
- [Shaka Cafes — operator company profile and locations](https://www.linkedin.com/company/shaka-cafes)
- [Nonie’s — official Boracay restaurant information](https://www.nonies.com.ph/)

- Keep source statuses attached to individual facts.
- Retain existing stable stop/Discover IDs when reusing venues.
- Do not convert `null` price to an asserted free admission.
- Do not insert excursion, package, or separate-base records into ordinary local-day generation.
- Preserve existing saved-trip snapshots and generic custom meal entries without counting them as curated venues.

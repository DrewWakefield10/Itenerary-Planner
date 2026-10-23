import {z} from "zod/v3";
import type {Stop} from "./types";
import {foodPlaceTypes} from "./food";

export const placeTypes = ["beach","cafe","restaurant","bakery","bar","museum","heritage","church","park","garden","market","shopping","viewpoint","island","waterfall","cave","lake","river","trail","wildlife","activity"] as const;
export const placeTypeSchema=z.enum(placeTypes);
export type PlaceType=z.infer<typeof placeTypeSchema>;
export const placeTypeLabels:Record<PlaceType,string>={beach:"Beaches",cafe:"Cafés",restaurant:"Restaurants",bakery:"Bakeries",bar:"Bars",museum:"Museums",heritage:"Heritage sites",church:"Religious sites",park:"Parks",garden:"Gardens",market:"Markets",shopping:"Shops",viewpoint:"Viewpoints",island:"Islands",waterfall:"Waterfalls",cave:"Caves",lake:"Lakes & lagoons",river:"Rivers",trail:"Trails",wildlife:"Wildlife venues",activity:"Activity venues"};

/** Editorial classification of the source-reviewed identities/descriptions, by stable
 * ID. No name matching: a beachfront restaurant is not a beach. Missing entries
 * remain unclassified and cannot satisfy an exact place-type request. This does
 * not verify opening, access, coordinates, or prices. See docs/itinerary-selection.md. */
const classified:Partial<Record<PlaceType,string>>={
  beach:"el-nido-corong-corong-beach el-nido-lio-beach-afternoon el-nido-nacpan-beach el-nido-maremegmeg-beach el-nido-duli-beach el-nido-seven-commandos-beach el-nido-entalula-beach el-nido-hidden-beach el-nido-secret-beach coron-cyc-beach siargao-pacifico-beach siargao-alegria-beach siargao-malinao-beach bohol-alona-beach-walk bohol-danao-beach-afternoon bohol-doljo-beach bohol-dumaluan-beach bohol-libaong-beach boracay-white-beach-station-2 boracay-white-beach-station-1 boracay-bulabog-beach-walk boracay-diniwid-beach boracay-puka-shell-beach boracay-ilig-iligan-beach boracay-tambisaan-beach boracay-tulubhan-beach boracay-balinghai-beach batanes-valugan-boulder-beach batanes-morong-beach",
  cafe:"siargao-brunch-spot cebu-abaca-baking-crossroads bohol-common-crew bohol-shaka-panglao boracay-cafe-del-sol batanes-harbour-cafe batanes-honesty-coffee-shop iloilo-baking-studio-theos",
  bakery:"puerto-princesa-bakers-hill cebu-abaca-baking-crossroads iloilo-baking-studio-theos iloilo-biscocho-haus manila-eng-bee-tin-ongpin",
  restaurant:"el-nido-artcafe el-nido-trattoria-altrove coron-trattoria-altrove siargao-kermit-restaurant siargao-trattoria-altrove siargao-warung siargao-brunch-spot siargao-bravo-restaurant siargao-naga-restaurant cebu-pig-and-palm bohol-bohol-bee-farm bohol-saffron-restaurant bohol-latavola-restaurant bohol-prawn-farm-bolod boracay-nonies-ondus boracay-muchos boracay-jammers-beach-shack boracay-aria-cucina boracay-hama boracay-beach-truck boracay-dinibeach-bar boracay-sirena boracay-los-indios-bravos boracay-sands-bar-restaurant baguio-original-good-taste baguio-choco-late-batirol baguio-hill-station baguio-amare-outlook baguio-craft-1945 batanes-casa-napoli-town batanes-beehan batanes-vunong-dinette iloilo-breakthrough-villa iloilo-dapli-valeria iloilo-ponsyon-plazuela davao-jacks-ridge-shrine-hills davao-marina-tuna-sandawa manila-ilustrado-restaurant manila-barbaras-heritage",
  bar:"el-nido-artcafe siargao-naga-restaurant cebu-turning-wheels-brewery boracay-dinibeach-bar boracay-sirena boracay-los-indios-bravos boracay-sands-bar-restaurant baguio-craft-brewery",
  market:"siargao-general-luna-market cebu-sugbo-mercado cebu-carbon-market boracay-dtalipapa-market baguio-baguio-public-market davao-roxas-night-market davao-poblacion-market-central",
  shopping:"el-nido-kalye-artisano boracay-d-mall-food-stroll boracay-citymall baguio-pilak-silvercraft baguio-nardas-handwoven baguio-good-shepherd iloilo-biscocho-haus iloilo-festive-walk-mall davao-apo-ni-lola-matina",
  museum:"puerto-princesa-palawan-heritage-center puerto-princesa-palawan-museum puerto-princesa-world-war-ii-memorial-museum cebu-casa-gorordo cebu-national-museum cebu-museo-sugbo cebu-yap-sandiego-house bohol-nova-shell-museum baguio-baguio-museum baguio-aguinaldo-museum baguio-museo-kordilyera baguio-mansion-house baguio-slu-museum batanes-national-museum iloilo-national-museum-western-visayas iloilo-museo-iloilo iloilo-economic-history-museum iloilo-ilomoca iloilo-brandy-museum iloilo-camina-balay-nga-bato davao-museo-dabawenyo-area davao-national-museum davao-bone-collector-museum davao-imin-museum manila-san-agustin-museum-area manila-casa-manila manila-museo-intramuros manila-centro-turismo manila-bahay-tsinoy manila-destileria-limtuaco manila-national-museum-fine-arts manila-national-museum-anthropology manila-national-museum-natural-history manila-museo-pambata",
  church:"coron-saint-augustine-parish puerto-princesa-immaculate-conception-cathedral-surroundings cebu-basilica-santo-nino cebu-taoist-temple cebu-argao-church bohol-saint-augustine-church bohol-dauis-church baguio-baguio-cathedral-area baguio-lourdes-grotto baguio-pink-sisters batanes-basco-cathedral batanes-tukon-chapel batanes-san-carlos-borromeo batanes-ivana-san-jose-church batanes-sabtang-san-vicente iloilo-molo-church-plaza iloilo-jaro-cathedral iloilo-san-jose-church davao-san-pedro-cathedral-area davao-holy-infant-jesus-shrine sagada-church-of-saint-mary-area manila-manila-cathedral-area",
  park:"coron-lualhati-park puerto-princesa-puerto-princesa-baywalk puerto-princesa-mendoza-park puerto-princesa-princess-eulalia-park puerto-princesa-balayong-peoples-park siargao-paseo-de-cabuntog bohol-panglao-town-plaza boracay-balabag-wetland-park baguio-burnham-park baguio-wright-park baguio-camp-john-hay baguio-heritage-hill baguio-malcolm-square baguio-mines-view-park batanes-basco-plaza iloilo-iloilo-river-esplanade iloilo-plaza-libertad davao-people-s-park davao-rizal-park davao-osmena-park davao-dona-vicenta-park davao-bago-esplanade davao-gulf-view-esplanade davao-marfori-botanical-garden davao-toril-park davao-matina-linear-park davao-candelaria-park davao-communal-pocket-park manila-plaza-roma manila-paco-park manila-arroceros-forest-park",
  garden:"puerto-princesa-butterfly-ecological-garden cebu-sirao-garden baguio-botanical-garden baguio-maryknoll-sanctuary baguio-bamboo-sanctuary davao-malagos-garden-resort manila-puerta-real-gardens",
  viewpoint:"coron-mount-tapyas puerto-princesa-mitra-ranch puerto-princesa-buenavista-viewdeck siargao-coconut-viewdeck cebu-tops-lookout bohol-chocolate-hills boracay-mount-luho baguio-mines-view-park batanes-basco-lighthouse-area batanes-vayang-rolling-hills batanes-rakuh-a-payaman batanes-chawa-viewdeck batanes-tayid-lighthouse batanes-chamantad-tinyan sagada-blue-soil sagada-langsayan sagada-marlboro-hills",
  island:"el-nido-shimizu-island el-nido-snake-island el-nido-helicopter-island coron-malcapuya-island coron-banana-island coron-bulog-dos-island coron-pass-island coron-ditaytayan-sandbar siargao-naked-island siargao-daku-island siargao-guyam-island cebu-oslob-sumilon-island bohol-balicasag-island boracay-crocodile-island",
  waterfall:"el-nido-nagkalit-kalit-falls siargao-taktak-falls cebu-kawasan-falls sagada-bokong-falls sagada-bomod-ok-falls sagada-pongas-falls",
  cave:"el-nido-cudugnon-cave el-nido-cathedral-cave puerto-princesa-underground-river siargao-tayangban-cave-pool bohol-hinagdanan-cave sagada-balangagan-cave sagada-lumiang-cave sagada-sumaguing-cave sagada-latang-underground-river",
  lake:"el-nido-big-lagoon el-nido-secret-lagoon el-nido-small-lagoon el-nido-cadlao-lagoon coron-kayangan-lake coron-barracuda-lake coron-twin-lagoon siargao-sugba-lagoon sagada-ubwa-blue-lagoon",
  river:"puerto-princesa-iwahig-firefly-watching puerto-princesa-underground-river siargao-maasin-river bohol-loboc-river-cruise sagada-latang-underground-river",
  trail:"batanes-mount-iraya sagada-ampacao sagada-nabas-ang",
  wildlife:"puerto-princesa-wildlife-rescue-center cebu-ocean-park davao-philippine-eagle-center davao-crocodile-park manila-ocean-park",
  activity:"siargao-cloud-9 siargao-clubhouse-golf coron-skeleton-wreck coron-lusong-gunboat coron-east-tangat-wreck coron-lusong-coral-garden siargao-magpupungko-rock-pools coron-maquinit-hot-springs puerto-princesa-ugong-rock davao-eden-nature-park davao-gap-farm davao-dleonor-inland-resort batanes-rakuh-idi-spring",
  heritage:"el-nido-kalye-artisano puerto-princesa-plaza-cuartel siargao-santa-monica-pier siargao-catangnan-bridge siargao-lokal-hub-general-luna cebu-fort-san-pedro cebu-magellan-s-cross-area cebu-heritage-monument cebu-yap-sandiego-house cebu-colon-street cebu-temple-of-leah bohol-panglao-watchtower boracay-willys-rock baguio-tam-awan-village baguio-easter-weaving-room baguio-ili-likha baguio-heritage-hill batanes-casa-real batanes-dipnaysupuan-tunnel batanes-fundacion-pacita batanes-diura-village batanes-house-of-dakay batanes-san-jose-spanish-bridge batanes-songsong-ruins batanes-savidug-village batanes-chavayan-village iloilo-molo-mansion iloilo-casa-real iloilo-calle-real iloilo-jaro-plaza-heritage-area iloilo-camina-balay-nga-bato davao-kadayawan-cultural-village davao-chinatown davao-japanese-tunnel sagada-hanging-coffins sagada-lumiang-cave manila-fort-santiago-area manila-baluarte-san-diego",
};
classified.garden+=" bohol-green-thumb-farm";
const byId=new Map<string,PlaceType[]>();
for(const type of placeTypes)for(const id of classified[type]?.split(" ")||[])byId.set(id,[...(byId.get(id)||[]),type]);
export function typesForStop(id:string):PlaceType[]{return [...new Set([...(byId.get(id)||[]),...foodPlaceTypes(id)])];}
const preferenceTypes:Record<string,PlaceType[]>={
  "Beach Bum":["beach"],"Food Hunter":["cafe","restaurant","bakery","bar","market"],
  "Culture Seeker":["museum","heritage","church"],"City Wanderer":["museum","heritage","church","park","market","shopping"],
  "Nature Lover":["beach","garden","park","island","waterfall","cave","lake","river","trail","viewpoint","wildlife"],
  "Mountain Explorer":["trail","viewpoint","waterfall"],"Adventure Junkie":["trail","cave","activity","island"],
  "Slow Traveler":["park","garden","beach","cafe","museum"],"Hidden Gem Collector":[...placeTypes],
};
export function matchesPlacePreferences(stop:Stop,request:{activityCategories?:PlaceType[];interests:string[]}){
  const types=stop.placeTypes||[];
  if(request.activityCategories?.length)return request.activityCategories.some(t=>types.includes(t));
  if(!request.interests.length)return true;
  if(types.length)return request.interests.some(i=>preferenceTypes[i]?.some(t=>types.includes(t)));
  // Broad legacy labels cannot qualify unknown entries for these exact intentions.
  return request.interests.some(i=>i!=="Beach Bum"&&i!=="Food Hunter"&&stop.interests.includes(i));
}

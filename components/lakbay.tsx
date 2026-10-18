"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Compass,
  Heart,
  Menu,
  X,
  Sun,
  Mountain,
  Utensils,
  Palmtree,
  BookOpen,
  Sparkles,
  Wallet,
  Check,
  Search,
  ArrowLeft,
} from "lucide-react";
import {
  selectableDestinations,
  destinationImage,
  destination,
  categories,
  templates,
  peso,
  type Destination,
} from "@/lib/destinations";
import { readLocal, writeLocal } from "@/lib/storage";
import Planner from "./planner";
import TripView from "./trip-view";
import SavedTrips from "./saved-trips";
import {
  SourceIndicator,
  SourceReviewNote,
  AdvisorySources,
} from "./source-indicator";
export function Photo({
  slug,
  className = "",
  eager = false,
}: {
  slug: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      className={className}
      src={destinationImage(slug)}
      alt={`${destination(slug)?.name || slug} scenery`}
      loading={eager ? "eager" : "lazy"}
    />
  );
}
export function Stamp() {
  return (
    <div className="stamp">
      <Sun size={27} />
      <span>PHILIPPINES</span>
      <small>GO. WANDER. REPEAT.</small>
    </div>
  );
}
export function DestinationCard({
  d,
  index = 0,
}: {
  d: Destination;
  index?: number;
}) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(readLocal<string[]>("favorites", []).includes(d.slug));
  }, [d.slug]);
  return (
    <article className={`postcard card-${index % 3}`}>
      <Link href={`/destinations/${d.slug}`} className="photo-link">
        <Photo slug={d.slug} />
        <span className="destination-tag">{d.tags[0]}</span>
      </Link>
      <button
        className={`heart ${saved ? "saved" : ""}`}
        aria-label={`${saved ? "Unsave" : "Save"} ${d.name}`}
        onClick={() => {
          const list = readLocal<string[]>("favorites", []);
          if (
            writeLocal(
              "favorites",
              saved ? list.filter((s) => s !== d.slug) : [...list, d.slug],
            )
          )
            setSaved(!saved);
        }}
      >
        <Heart size={19} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="postcard-body">
        <small>{d.province ? `${d.province} · ${d.region}` : d.region}</small>
        <Link href={`/destinations/${d.slug}`}>
          <h3>
            {d.name}
            <ArrowUpRight size={21} />
          </h3>
        </Link>
        <p>{d.caption}</p>
        <div className="card-meta">
          <span>
            {d.days}–{d.days + 2} days of discovery
          </span>
          <span>from {peso(d.daily)} / day*</span>
        </div>
      </div>
    </article>
  );
}
export default function Lakbay() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const f = () => setStorageError(true);
    window.addEventListener("storage-failure", f);
    return () => window.removeEventListener("storage-failure", f);
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  const slug = path.split("/")[2];
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="header">
        <Link href="/" className="brand">
          <Compass size={34} strokeWidth={1.5} />
          <span>
            lakbay<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav className={menu ? "open" : ""} aria-label="Main navigation">
          {[
            ["/explore", "Explore"],
            ["/planner", "Plan a Trip"],
            ["/templates", "Travel Guides"],
            ["/my-trips", "My Trips"],
          ].map(([url, name]) => (
            <Link
              className={path.startsWith(url) ? "active" : ""}
              href={url}
              key={url}
            >
              {name}
            </Link>
          ))}
        </nav>
        <Link href="/planner" className="button small header-cta">
          Let’s get lost <ArrowUpRight size={16} />
        </Link>
        <button
          className="menu-toggle icon-button"
          aria-label="Toggle navigation"
          disabled={!hydrated}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      {storageError && (
        <div className="notice error" role="alert">
          This browser could not save your changes. Enable local storage or free
          space before leaving.
          <button onClick={() => setStorageError(false)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      <main id="main">
        {path === "/" ? (
          <Home />
        ) : path === "/explore" ? (
          <Explore />
        ) : path.startsWith("/destinations/") ? (
          <Details slug={slug} />
        ) : path === "/templates" ? (
          <Templates />
        ) : path === "/planner" ? (
          <PlannerEntry />
        ) : path.startsWith("/trips/") ? (
          <TripEntry />
        ) : path === "/my-trips" ? (
          <SavedEntry />
        ) : path === "/profile" ? (
          <Profile />
        ) : (
          <div className="page empty">
            <h1>This page wandered off.</h1>
            <Link className="button" href="/">
              Back home
            </Link>
          </div>
        )}
      </main>
      <footer>
        <div className="footer-top">
          <Link href="/" className="brand">
            <Compass size={30} />
            lakbay.
          </Link>
          <span className="handwritten">Collect moments, not just miles.</span>
          <Link href="/planner">
            Your next chapter <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>
            Made for the Philippines. Made for your kind of adventure.
          </span>
          <Link href="/profile">Preferences & photo credits</Link>
          <span>YOUR PHILIPPINES, YOUR ADVENTURE.</span>
        </div>
      </footer>
    </>
  );
}
function Home() {
  return (
    <>
      <section className="hero page">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-star">✳</span> A LOVE LETTER TO THE
            PHILIPPINES
          </span>
          <h1>
            Every Island
            <br />
            Has a <em>Story.</em>
          </h1>
          <p>
            Discover hidden gems, explore local favorites, and create your
            perfect Philippine adventure with AI.
          </p>
          <div className="hero-actions">
            <Link href="/planner" className="button">
              Plan My Adventure <ArrowUpRight size={19} />
            </Link>
            <Link href="/explore" className="text-link">
              Explore Destinations <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-note">
            <span className="doodle-arrow">↳</span>
            <span className="handwritten">
              Less planning. More “tara, let’s go!”
            </span>
          </div>
          <div className="hero-footnote">
            <span>
              <Check size={14} /> Made for your budget
            </span>
            <span>
              <Check size={14} /> Your pace, your adventure
            </span>
          </div>
        </div>
        <div className="hero-collage">
          <div className="hero-photo">
            <div className="tape" />
            <Photo slug="palawan" eager />
            <div className="photo-caption">
              <span>El Nido, Palawan</span>
              <MapPin size={17} />
            </div>
          </div>
          <div className="small-photo">
            <Photo slug="siargao" eager />
            <span className="handwritten">Somewhere you’d rather be.</span>
          </div>
          <Stamp />
          <div className="coordinate">11°10′ N · 119°23′ E</div>
          <span className="collage-note handwritten">
            Your next story
            <br />
            starts here ↗
          </span>
        </div>
      </section>
      <div className="ticker">
        <span>7,641 islands. Endless possibilities.</span>
        <span>✳</span>
        <span>One adventure that’s entirely yours.</span>
        <span>✳</span>
        <span>Tara, let’s explore.</span>
        <span>✳</span>
      </div>
      <section className="page section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / PLACES THAT STAY WITH YOU</span>
            <h2>
              Pick a place. <em>Find your story.</em>
            </h2>
          </div>
          <Link href="/explore" className="text-link">
            All destinations <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="featured-grid">
          {selectableDestinations.filter(d => ["el-nido", "siargao", "cebu"].includes(d.slug)).map((d, i) => (
            <DestinationCard d={d} index={i} key={d.slug} />
          ))}
        </div>
        <p className="fine-print">
          *Illustrative daily allowances per person. Not live prices; excludes
          travel to the destination.
        </p>
      </section>
      <section className="personality-section">
        <div className="page personality-layout">
          <div>
            <span className="eyebrow">02 / TRAVEL YOUR WAY</span>
            <h2>
              What kind of
              <br />
              <em>wanderer are you?</em>
            </h2>
            <p>
              No two adventures should look the same.
              <br />
              Follow what makes you feel alive.
            </p>
            <span className="handwritten">There’s no wrong way to wander.</span>
          </div>
          <div className="personality-grid">
            {[
              {
                Icon: Palmtree,
                title: "Beach Bum",
                cat: "Beaches",
                desc: "Saltwater & slow days",
              },
              {
                Icon: Mountain,
                title: "Mountain Explorer",
                cat: "Mountains",
                desc: "Fresh air & higher places",
              },
              {
                Icon: Utensils,
                title: "Food Hunter",
                cat: "Food",
                desc: "One delicious detour at a time",
              },
              {
                Icon: Compass,
                title: "Culture Seeker",
                cat: "Culture",
                desc: "Old stories & new perspectives",
              },
            ].map(({ Icon, title, cat, desc }) => (
              <Link
                href={`/explore?category=${cat}`}
                className="personality"
                key={title}
              >
                <Icon size={31} strokeWidth={1.3} />
                <h3>{title}</h3>
                <p>{desc}</p>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="page section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 / BORROW A LITTLE INSPIRATION</span>
            <h2>
              A head start on <em>your next chapter.</em>
            </h2>
          </div>
          <Link href="/templates" className="text-link">
            All travel guides <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="template-grid">
          {templates.slice(0, 3).map((t) => (
            <Link
              className="template-card"
              href={`/planner?destinations=${t.slugs.join(",")}&days=${t.days}`}
              key={t.title}
            >
              <Photo slug={t.slugs[0]} />
              <div>
                <span className="eyebrow">{t.days} DAYS · YOUR PACE</span>
                <h3>{t.title}</h3>
                <span>
                  Make it your own <ArrowUpRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="page how-section">
        <div>
          <span className="eyebrow">A LITTLE HELP. A LOT OF POSSIBILITY.</span>
          <h2>
            From “what if”
            <br />
            to <em>“we’re going.”</em>
          </h2>
          <Link className="button" href="/planner">
            Let’s make a plan <Sparkles size={17} />
          </Link>
        </div>
        <div className="how-steps">
          {[
            [
              "01",
              "Tell us your travel story",
              "Your people, your interests, your budget. Start with the things that matter to you.",
            ],
            [
              "02",
              "Find your kind of adventure",
              "Get a day-by-day plan with time to explore, eat well, and take a breath.",
            ],
            [
              "03",
              "Make it yours, then make memories",
              "Move a stop, add a detour, save your journal. You’re in charge of the journey.",
            ],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span className="step-number">{n}</span>
              <section>
                <h3>{title}</h3>
                <p>{body}</p>
              </section>
            </div>
          ))}
        </div>
      </section>
      <section className="page bottom-stories">
        <Link href="/explore?category=Budget" className="budget-story">
          <Wallet size={29} />
          <span className="eyebrow">BIG MEMORIES. SMALLER BUDGETS.</span>
          <h2>
            A little goes
            <br />
            <em>a long way.</em>
          </h2>
          <p>Find a wallet-friendly escape, starting with Baguio and Iloilo.</p>
          <span className="text-link">
            Explore budget adventures <ArrowRight size={18} />
          </span>
        </Link>
        <div className="season-story">
          <Sun size={28} />
          <span className="eyebrow">LEAVE ROOM FOR THE WEATHER</span>
          <h3>A good plan has a Plan B.</h3>
          <p>
            Trade a rainy beach afternoon for a local food stop. Keep the joy,
            change the plan.
          </p>
          <Link className="text-link" href="/templates">
            Find a flexible itinerary <ArrowRight size={18} />
          </Link>
          <hr />
          <BookOpen size={25} />
          <h3>A little preparation, a lot of peace.</h3>
          <p>
            Your saved trip includes an editable packing list and official
            travel guidance links.
          </p>
          <Link href="/my-trips" className="text-link">
            Open your travel journal <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="journal-cta page">
        <span className="eyebrow">GOOD STORIES DESERVE A PLACE TO LIVE</span>
        <h2>
          Your adventures. <em>All in one journal.</em>
        </h2>
        <p>
          Save the plans. Keep the little notes. Come back for the next chapter.
        </p>
        <Link href="/my-trips" className="button">
          My travel journal <BookOpen size={18} />
        </Link>
        <span className="handwritten">Locally saved. Always yours.</span>
      </section>
    </>
  );
}
function Explore() {
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("category");
    if (q && categories.includes(q)) setCategory(q);
    setSaved(readLocal("favorites", []));
    setReady(true);
  }, []);
  const filtered = selectableDestinations.filter(
    (d) =>
      (category === "All" || d.tags.includes(category)) &&
      `${d.name} ${d.province || ""} ${d.region} ${d.description}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!favorites || saved.includes(d.slug)),
  );
  return (
    <section className="page section">
      <Link className="breadcrumb" href="/">
        Home / Explore
      </Link>
      <span className="eyebrow">THE PHILIPPINES, ONE DISCOVERY AT A TIME</span>
      <h1 className="page-title">
        Where will your <em>curiosity go?</em>
      </h1>
      <p className="lede">
        From saltwater mornings to mountain air. Find a place that feels like
        you.
      </p>
      <div className="explore-tools">
        <label className="search">
          <Search size={20} />
          <input
            aria-label="Search destinations"
            disabled={!ready}
            placeholder="Search an island, a city, a feeling…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className={`button secondary ${favorites ? "selected" : ""}`}
          onClick={() => {
            setSaved(readLocal("favorites", []));
            setFavorites(!favorites);
          }}
        >
          <Heart size={17} /> {favorites ? "All destinations" : "My favorites"}
        </button>
      </div>
      <div className="chips">
        {categories.map((c) => (
          <button
            className={category === c ? "selected" : ""}
            disabled={!ready}
            onClick={() => setCategory(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="fine-print">
        {filtered.length} places to begin · Budget figures are estimates, not
        live quotes.
      </p>
      <div className="destination-grid">
        {filtered.map((d, i) => (
          <DestinationCard d={d} index={i} key={d.slug} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">
          <Compass size={40} />
          <h3>No places found just yet.</h3>
          <button
            className="button"
            onClick={() => {
              setCategory("All");
              setSearch("");
              setFavorites(false);
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
function Details({ slug }: { slug: string }) {
  const d = destination(slug);
  if (!d)
    return (
      <section className="page empty">
        <h1>Destination not found.</h1>
        <Link href="/explore">Explore destinations</Link>
      </section>
    );
  return (
    <section className="page section">
      <Link href="/explore" className="breadcrumb">
        <ArrowLeft size={15} /> Back to all destinations
      </Link>
      <div className="detail-hero">
        <div>
          <span className="eyebrow">
            {d.province ? `${d.province} / ` : ""}{d.region} / PHILIPPINES{" "}
            <SourceIndicator source={d.sources.region} label="Region" />
          </span>
          <h1>
            {d.name}
            <span className="handwritten">{d.caption}</span>
          </h1>
          <p className="lede">{d.description}</p>
          <SourceIndicator
            source={d.sources.description}
            label="Destination description"
          />
          <div className="chips">
            {d.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <Link
            className="button"
            href={`/planner?destinations=${d.slug}&days=${d.days}`}
          >
            {d.legacyOnly ? "Choose a Palawan base" : `Plan my ${d.name} adventure`} <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="detail-photo">
          <Photo slug={d.slug} eager />
          <Stamp />
        </div>
      </div>
      <div className="detail-facts">
        <div>
          <span>A LITTLE TIME</span>
          <strong>
            {d.days}–{d.days + 2} days
          </strong>
          <SourceIndicator
            source={d.sources.schedule}
            label="Suggested duration"
          />
        </div>
        <div>
          <span>A DAILY ALLOWANCE</span>
          <strong>{peso(d.daily)} / person*</strong>
          <SourceIndicator source={d.sources.price} label="Daily allowance" />
        </div>
        <div>
          <span>A LITTLE LOCAL FLAVOR</span>
          <p>{d.food}</p>
          <SourceIndicator source={d.sources.food} label="Food suggestions" />
        </div>
      </div>
      <div className="details-columns">
        <section>
          <span className="eyebrow">PUT THESE IN YOUR JOURNAL</span>
          <h2>Start exploring.</h2>
          {d.stops.map((s) => (
            <article className="attraction-source-row" key={s.name}>
              <a
                className="attraction-row"
                href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={21} />
                <span>
                  <h3>{s.name}</h3>
                  <small>{s.category} · View location</small>
                </span>
                <ArrowUpRight size={17} />
              </a>
              <p>
                {s.locationDetails}{" "}
                <SourceIndicator
                  source={s.sources.location}
                  label={`${s.name} location context`}
                />
              </p>
              <p className="coordinate-source">
                Map pin{" "}
                <SourceIndicator
                  source={s.sources.coordinates}
                  label={`${s.name} coordinates`}
                />
              </p>
            </article>
          ))}
        </section>
        <aside className="paper-note">
          <h3>Before you go</h3>
          <h4>Location context</h4>
          <p>
            {d.locationDetails}{" "}
            <SourceIndicator
              source={d.sources.location}
              label="Destination location context"
            />
          </p>
          <h4>Getting around</h4>
          <p>
            {d.transport}{" "}
            <SourceIndicator
              source={d.sources.transport}
              label="Destination transport guidance"
            />
          </p>
          <h4>Seasons & flexibility</h4>
          <p>
            {d.season}{" "}
            <SourceIndicator
              source={d.sources.season}
              label="Seasonal guidance"
            />
          </p>
          <h4>Accessibility</h4>
          <p>
            {d.accessibility}{" "}
            <SourceIndicator
              source={d.sources.accessibility}
              label="Destination accessibility"
            />
          </p>
          <h4>Travel intensity</h4>
          <p>
            Choose Chill for fewer stops and longer breaks. Confirm
            accessibility and opening hours with each venue.
          </p>
          <small>
            *Illustrative allowances and approximate map pins. No live prices or
            verified operating hours.
          </small>
          <h4>Official advisory sources</h4>
          <AdvisorySources links={d.advisories} />
          <SourceReviewNote />
          <a
            className="text-link"
            href="https://philippines.travel/destinations"
            target="_blank"
            rel="noreferrer"
          >
            Official tourism inspiration <ArrowUpRight size={16} />
          </a>
        </aside>
      </div>
      <div className="section-heading">
        <h2>
          Keep <em>wandering.</em>
        </h2>
      </div>
      <div className="featured-grid">
        {selectableDestinations
          .filter(
            (x) => x.slug !== d.slug && x.tags.some((t) => d.tags.includes(t)),
          )
          .slice(0, 3)
          .map((x) => (
            <DestinationCard d={x} key={x.slug} />
          ))}
      </div>
    </section>
  );
}
function Templates() {
  return (
    <section className="page section">
      <span className="eyebrow">FIELD NOTES FOR YOUR NEXT ADVENTURE</span>
      <h1 className="page-title">
        A little inspiration.
        <br />
        <em>A lot of possibility.</em>
      </h1>
      <p className="lede">
        Thoughtful starting points, ready for your own detours. Customize dates,
        budget, and pace in the planner.
      </p>
      <div className="destination-grid">
        {templates.map((t) => (
          <article className="postcard" key={t.title}>
            <Photo slug={t.slugs[0]} />
            <div className="postcard-body">
              <span className="eyebrow">{t.days} DAYS · DEMO TEMPLATE</span>
              <h3>{t.title}</h3>
              <p>{destination(t.slugs[0])?.caption}</p>
              <p className="fine-print">
                Example stops:{" "}
                {destination(t.slugs[0])
                  ?.stops.slice(0, 2)
                  .map((s) => s.name)
                  .join(" → ")}
                .{" "}
                {t.slugs.length > 1
                  ? "Includes a connection-verification day."
                  : ""}
              </p>
              <Link
                href={`/planner?destinations=${t.slugs.join(",")}&days=${t.days}`}
                className="text-link"
              >
                Customize with AI <ArrowUpRight size={17} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Profile() {
  const [pace, setPace] = useState("Balanced");
  const [saved, setSaved] = useState(false);
  useEffect(() => setPace(readLocal("preferred-pace", "Balanced")), []);
  return (
    <section className="page section narrow">
      <span className="eyebrow">YOUR JOURNAL SETTINGS</span>
      <h1 className="page-title">
        Your kind of <em>travel.</em>
      </h1>
      <div className="paper-note">
        <label>
          Preferred pace
          <select
            value={pace}
            onChange={(e) => {
              setPace(e.target.value);
              setSaved(false);
            }}
          >
            {["Chill", "Balanced", "Packed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button
          className="button"
          onClick={() => setSaved(writeLocal("preferred-pace", pace))}
        >
          Save preferences <Check size={17} />
        </button>
        {saved && <p role="status">Saved on this browser.</p>}
        <h3>A note about your data</h3>
        <p>
          Trips, favorites, and planner drafts stay in this browser. Clearing
          browser data removes them. Export a backup from your trip. Accounts
          and shared editing are not connected.
        </p>
        <h3>About the travel information</h3>
        <p>
          Seed itineraries use estimated allowances and approximate locations.
          Confirm transport, accessibility, prices, and opening times before
          travel.
        </p>
        <a
          href="/image-credits.txt"
          className="text-link"
          target="_blank"
          rel="noreferrer"
        >
          Photo sources & licenses <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}
function PlannerEntry() {
  return <Planner />;
}
function TripEntry() {
  return <TripView />;
}
function SavedEntry() {
  return <SavedTrips />;
}

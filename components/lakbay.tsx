"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Compass,
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
} from "lucide-react";
import {
  selectableDestinations,
  templates,
} from "@/lib/destinations";
import { readLocal, writeLocal } from "@/lib/storage";
import Planner from "./planner";
import TripView from "./trip-view";
import SavedTrips from "./saved-trips";
import SavedPlaces from "./bookmarks";
import AccountPage from "./account-page";
import {AccountMenu,useAccount} from "./account-provider";
import Discover, { DiscoveryTeaser } from "./discover";
import {Photo,Stamp,DestinationCard} from './destination-card';
import {Explore,DestinationDetails,TravelAdviceArticle} from './explore';
export default function Lakbay() {
  const path = usePathname();
  const account=useAccount();
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
            ["/discover", "Discover"],
            ["/explore", "Explore"],
            ["/planner", "Plan a Trip"],
            ["/my-trips", "My Trips"],
            ["/saved-places", "Saved Places"],
          ].map(([url, name]) => (
            <Link
              className={path.startsWith(url)||(url==='/explore'&&path.startsWith('/destinations/')) ? "active" : ""}
              aria-current={path.startsWith(url)||(url==='/explore'&&path.startsWith('/destinations/'))?'page':undefined}
              href={url}
              key={url}
            >
              {name}
            </Link>
          ))}
          <AccountMenu/>
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
        ) : path === '/explore/advice' ? (
          <Explore advice />
        ) : path.startsWith('/explore/advice/') ? (
          <TravelAdviceArticle slug={path.split('/')[3]}/>
        ) : path === "/discover" || path.startsWith("/discover/") ? (
          <Discover key={slug || "all"} placeId={slug} />
        ) : path.startsWith("/destinations/") ? (
          <DestinationDetails slug={slug} />
        ) : path === "/planner" ? (
          <PlannerEntry />
        ) : path.startsWith("/trips/") ? (
          <TripEntry />
        ) : path === "/my-trips" ? (
          <SavedEntry />
        ) : path === "/saved-places" ? (
          <SavedPlaces key={account.user?.id||"guest"}/>
        ) : path === "/account" ? (
          <AccountPage key={account.user?.id||"guest"}/>
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
          <nav aria-label="Footer navigation"><Link href="/explore">Explore destinations</Link><Link href="/explore/advice">Travel advice</Link><Link href="/profile">Preferences & photo credits</Link></nav>
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
      <DiscoveryTeaser />
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
          <Link href="/explore/advice" className="text-link">
            Travel advice & trip starters <ArrowUpRight size={18} />
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
          <Link className="text-link" href="/explore/advice">
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
        <span className="handwritten">Your plans. Your next chapter.</span>
      </section>
    </>
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
          Guest trips, destination favorites and planner drafts stay in this browser. Account trips and saved places are stored privately after Google sign-in and an explicit save. Export a backup before clearing browser drafts.
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
  const account=useAccount();return <TripView key={account.user?.id||"guest"}/>;
}
function SavedEntry() {
  const account=useAccount();return <SavedTrips key={account.user?.id||"guest"}/>;
}

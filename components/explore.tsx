"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Compass,
  Heart,
  Search,
  X,
} from "lucide-react";
import {
  destination,
  selectableDestinations,
  templates,
  peso,
} from "@/lib/destinations";
import {
  exploreInterests,
  exploreDestinations,
  discoverForDestination,
  guideHighlights,
  guideFood,
  planDestination,
  startersForDestination,
} from "@/lib/explore";
import { travelAdvice, adviceArticle } from "@/lib/travel-advice";
import { discoveryPlace } from "@/lib/discovery";
import {
  DestinationCard,
  Photo,
  Stamp,
  useDeviceFavorites,
} from "./destination-card";
import { BookmarkButton } from "./bookmarks";
import { useAccount } from "./account-provider";
import {
  SourceIndicator,
  SourceReviewNote,
  AdvisorySources,
} from "./source-indicator";
import { PlaceCard } from "./discover";

function AdviceLinks() {
  return (
    <ul className="explore-advice-links">
      {travelAdvice.map((a) => (
        <li key={a.slug}>
          <Link href={`/explore/advice/${a.slug}`}>
            {a.title}
            <ArrowUpRight size={17} />
          </Link>
          <p>{a.summary}</p>
        </li>
      ))}
    </ul>
  );
}
function TripStarters({ slug }: { slug?: string }) {
  const starters = slug ? startersForDestination(slug) : templates;
  if (!starters.length) return null;
  return (
    <section className="explore-starters" aria-labelledby="starters-title">
      <h2 id="starters-title">
        A starting point for <em>your trip.</em>
      </h2>
      <p>
        Existing demo templates. Suggested lengths and example stops are
        planning ideas; customize them in the separate planner.
      </p>
      <div className="explore-starter-grid">
        {starters.map((t) => (
          <article className="paper-note" key={t.title}>
            <span className="eyebrow">{t.days} DAYS / DEMO TEMPLATE</span>
            <h3>{t.title}</h3>
            <p>
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
              className="text-link"
              href={`/planner?destinations=${t.slugs.join(",")}&days=${t.days}`}
            >
              Customize in Plan a Trip <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Explore({ advice = false }: { advice?: boolean }) {
  const params = useSearchParams(),
    router = useRouter(),
    account = useAccount(),
    deviceFavorites = useDeviceFavorites();
  const [search, setSearch] = useState(params.get("q") || "");
  const category = params.get("category") || "All",
    favorites = params.get("saved") === "1";
  useEffect(() => {
    const restore = () =>
      setSearch(new URLSearchParams(window.location.search).get("q") || "");
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const saved = account.enabled
    ? account.bookmarks
        .filter((id) => id.startsWith("base-"))
        .map((id) => id.slice(5))
    : deviceFavorites;
  const filtered = exploreDestinations({
    search,
    category,
    ...(favorites ? { saved } : {}),
  });
  const palawan = filtered.filter((d) => d.province === "Palawan"),
    others = filtered.filter((d) => d.province !== "Palawan");
  function href(changes: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    query.delete("view");
    if (search) query.set("q", search);
    else query.delete("q");
    for (const [key, value] of Object.entries(changes)) {
      if (key === "view") continue;
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    const path =
      changes.view === "advice"
        ? "/explore/advice"
        : changes.view === null
          ? "/explore"
          : advice
            ? "/explore/advice"
            : "/explore";
    return path + (query.size ? "?" + query : "");
  }
  function updateSearch(value: string) {
    setSearch(value);
    router.replace(href({ q: value || null }), { scroll: false });
  }
  function reset() {
    setSearch("");
    router.push(href({ q: null, category: null, saved: null }), {
      scroll: false,
    });
  }
  return (
    <section className="page section explore-page">
      <Link className="breadcrumb" href="/">
        Home / Explore
      </Link>
      <span className="eyebrow">
        DESTINATIONS & FIELD NOTES / THE PHILIPPINES
      </span>
      <div className="explore-intro">
        <div>
          <h1 className="page-title">
            Find your <em>next chapter.</em>
          </h1>
          <p className="lede">
            Get to know a destination, choose your overnight base, and prepare
            for the journey. Find individual places in Discover.
          </p>
        </div>
        <Link className="button secondary" href="/planner">
          Plan a Trip <ArrowUpRight size={17} />
        </Link>
      </div>
      <nav className="explore-views" aria-label="Explore views">
        <Link
          href={href({ view: null })}
          aria-current={!advice ? "page" : undefined}
        >
          Destinations
        </Link>
        <Link
          href={href({ view: "advice" })}
          aria-current={advice ? "page" : undefined}
        >
          Travel advice
        </Link>
      </nav>
      {advice ? (
        <>
          <section aria-labelledby="travel-advice-title">
            <h2 id="travel-advice-title">
              A little <em>preparation.</em>
            </h2>
            <p>
              Short planning checklists for transport, budgeting, packing and
              travel preparation. Current requirements, prices and schedules
              need their own checks.
            </p>
            <AdviceLinks />
          </section>
          <TripStarters />
        </>
      ) : (
        <>
          <div className="explore-tools">
            <label className="search">
              <Search size={20} />
              <input
                type="search"
                aria-label="Search destinations"
                placeholder="Search a destination, province or region…"
                value={search}
                onChange={(e) => {
                  if ((e.nativeEvent as InputEvent).isComposing)
                    setSearch(e.target.value);
                  else updateSearch(e.target.value);
                }}
                onCompositionEnd={(e) => updateSearch(e.currentTarget.value)}
              />
              {search && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Clear destination search"
                  onClick={(e) => {
                    const input =
                      e.currentTarget.parentElement?.querySelector("input");
                    updateSearch("");
                    input?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              type="button"
              className={`button secondary ${favorites ? "selected" : ""}`}
              aria-pressed={favorites}
              onClick={() =>
                router.push(href({ saved: favorites ? null : "1" }), {
                  scroll: false,
                })
              }
            >
              <Heart size={17} />
              {favorites
                ? "All destinations"
                : account.enabled
                  ? "My favorites"
                  : "Device favorites"}
            </button>
          </div>
          <div className="chips" aria-label="Browse destinations by interest">
            {exploreInterests.map((i) => (
              <button
                type="button"
                key={i.value}
                className={category === i.value ? "selected" : ""}
                aria-pressed={category === i.value}
                onClick={() =>
                  router.push(
                    href({ category: i.value === "All" ? null : i.value }),
                    { scroll: false },
                  )
                }
              >
                {i.label}
              </button>
            ))}
          </div>
          <section aria-labelledby="destination-guides-title">
            <h2 id="destination-guides-title">
              Destination <em>guides.</em>
            </h2>
            <p className="fine-print" role="status">
              {filtered.length} matching base guides. The full collection covers
              11 browsing destinations. Trip lengths and allowances are
              estimates.
            </p>
            {["Budget", "Family", "Hidden Gems"].includes(category) && (
              <p className="fine-print">
                “{category}” is a legacy planning lens, not a verified price,
                access or popularity assessment.
              </p>
            )}
            {!!palawan.length && (
              <section
                aria-labelledby="palawan-explore-title"
                className="explore-base-group"
              >
                <h3 id="palawan-explore-title">
                  Palawan <span>Choose an overnight base</span>
                </h3>
                <p>
                  El Nido, Coron and Puerto Princesa have separate guides and
                  transfers. Palawan is the browsing group.
                </p>
                <div className="destination-grid">
                  {palawan.map((d, i) => (
                    <DestinationCard key={d.slug} d={d} index={i} guide />
                  ))}
                </div>
              </section>
            )}
            {!!others.length && (
              <div className="destination-grid explore-base-group">
                {others.map((d, i) => (
                  <DestinationCard key={d.slug} d={d} index={i} guide />
                ))}
              </div>
            )}
            {!filtered.length && (
              <div className="empty">
                <Compass size={38} />
                <h3>No destinations match these choices.</h3>
                <p>Try another interest or destination name.</p>
                <button className="button" onClick={reset}>
                  Reset filters
                </button>
              </div>
            )}
          </section>
          <section
            className="explore-advice-preview"
            aria-labelledby="advice-preview-title"
          >
            <div className="section-heading">
              <h2 id="advice-preview-title">
                Before <em>you go.</em>
              </h2>
              <Link className="text-link" href={href({ view: "advice" })}>
                Travel advice & trip starters <ArrowUpRight size={17} />
              </Link>
            </div>
            <AdviceLinks />
          </section>
        </>
      )}
    </section>
  );
}

export function DestinationDetails({ slug }: { slug: string }) {
  const d = destination(slug);
  if (!d)
    return (
      <section className="page empty">
        <h1>Destination not found.</h1>
        <Link href="/explore">Explore destinations</Link>
      </section>
    );
  const palawanBases =
    d.province === "Palawan"
      ? selectableDestinations.filter((base) => base.province === "Palawan")
      : [];
  const highlights = guideHighlights(slug)
      .map((p) => discoveryPlace(p.id))
      .filter((p) => !!p),
    food = guideFood(slug);
  return (
    <section className="page section destination-guide">
      <Link href="/explore" className="breadcrumb">
        <ArrowLeft size={15} /> Back to all destinations
      </Link>
      <div className="detail-hero">
        <div>
          <span className="eyebrow">
            {d.province ? `${d.province} / ` : ""}
            {d.region} / PHILIPPINES{" "}
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
          {!d.legacyOnly && (
            <BookmarkButton placeId={`base-${d.slug}`} name={d.name} />
          )}
          <div className="chips">
            {d.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <Link
            className="button"
            href={d.legacyOnly ? "#travel-bases" : planDestination(slug)}
          >
            {d.legacyOnly ? "Choose a Palawan base" : "Plan a trip here"}{" "}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="detail-photo">
          <Photo slug={slug} eager />
          <Stamp />
        </div>
      </div>
      <div className="detail-facts">
        <div>
          <span>SUGGESTED TRIP LENGTH</span>
          <strong>
            {d.days}–{d.days + 2} days
          </strong>
          <p>A planning suggestion for this base.</p>
          <SourceIndicator
            source={d.sources.schedule}
            label="Suggested duration"
          />
        </div>
        <div>
          <span>ILLUSTRATIVE DAILY ALLOWANCE</span>
          <strong>{peso(d.daily)} / person*</strong>
          <SourceIndicator source={d.sources.price} label="Daily allowance" />
        </div>
        <div>
          <span>FOOD & CAFÉS</span>
          <p>{d.food}</p>
          <SourceIndicator source={d.sources.food} label="Food suggestions" />
        </div>
      </div>
      <section
        id="travel-bases"
        className="guide-areas"
        aria-labelledby="guide-areas-title"
      >
        <h2 id="guide-areas-title">
          Areas & <em>travel bases.</em>
        </h2>
        <p>
          {d.locationDetails}{" "}
          <SourceIndicator
            source={d.sources.location}
            label="Destination location context"
          />
        </p>
        {!!palawanBases.length && (
          <>
            <p>
              Choose each base separately. Moving between them requires a
              connection day; local stops do not.
            </p>
            <div className="guide-base-links">
              {palawanBases.map((base) => (
                <Link
                  key={base.slug}
                  href={`/destinations/${base.slug}`}
                  aria-current={slug === base.slug ? "page" : undefined}
                >
                  {base.name} <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          </>
        )}
        {!palawanBases.length && (
          <p className="fine-print">
            This guide uses the existing {d.name} planning base. Discover
            retains each place’s actual municipality; a browsing group is not a
            promise that every place is a local day trip.
          </p>
        )}
      </section>
      <section
        className="guide-highlights"
        aria-labelledby="guide-highlights-title"
      >
        <div className="section-heading">
          <h2 id="guide-highlights-title">
            A few places to <em>begin.</em>
          </h2>
          <Link className="text-link" href={discoverForDestination(slug)}>
            See all places <ArrowUpRight size={17} />
          </Link>
        </div>
        <p className="fine-print">
          A small catalog selection, not a popularity ranking. Full
          descriptions, photographs, videos and practical notes stay on each
          place’s page.
        </p>
        <div className="discovery-grid">
          {highlights.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      </section>
      <div className="details-columns guide-practical">
        <div>
          <section aria-labelledby="guide-food-title">
            <h2 id="guide-food-title">
              Food & <em>cafés.</em>
            </h2>
            <ul className="guide-food-links">
              {food.map((p) => (
                <li key={p.id}>
                  <Link href={`/discover/${p.id}`}>
                    {p.name} <ArrowUpRight size={15} />
                  </Link>
                  <small>
                    {p.city_municipality} / {p.destination_group}
                  </small>
                </li>
              ))}
            </ul>
            <Link
              className="text-link"
              href={discoverForDestination(slug) + "&category=Food+%26+drink"}
            >
              Browse food & cafés in Discover <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="guide-budget">
            <h2>
              Budget <em>context.</em>
            </h2>
            <p>
              The {peso(d.daily)} daily allowance is an illustrative estimate,
              not a live quote. Confirm inclusions and current costs with
              providers. Use Plan a Trip to choose flights, accommodation, group
              size and a reserve.
            </p>
            <SourceIndicator source={d.sources.price} label="Daily allowance" />
            <Link className="text-link" href="/explore/advice/budgeting">
              Read the budget planning guide <ArrowUpRight size={15} />
            </Link>
          </section>
          <TripStarters slug={slug} />
        </div>
        <aside className="paper-note">
          <h2>
            Before <em>you go.</em>
          </h2>
          <h3>Getting there & getting around</h3>
          <p>
            {d.transport}{" "}
            <SourceIndicator
              source={d.sources.transport}
              label="Destination transport guidance"
            />
          </p>
          <h3>Seasons & flexibility</h3>
          <p>
            {d.season}{" "}
            <SourceIndicator
              source={d.sources.season}
              label="Seasonal guidance"
            />
          </p>
          <h3>Accessibility</h3>
          <p>
            {d.accessibility}{" "}
            <SourceIndicator
              source={d.sources.accessibility}
              label="Destination accessibility"
            />
          </p>
          <p>
            Choose Chill for fewer stops and longer breaks. Confirm access and
            opening hours with each venue.
          </p>
          <h3>Official advisory sources</h3>
          <AdvisorySources links={d.advisories} />
          <SourceReviewNote />
          <a
            className="text-link"
            href="https://philippines.travel/destinations"
            target="_blank"
            rel="noreferrer"
          >
            Official tourism inspiration <ArrowUpRight size={15} />
          </a>
        </aside>
      </div>
      <section
        className="explore-advice-preview"
        aria-labelledby="destination-advice-title"
      >
        <h2 id="destination-advice-title">
          Practical <em>reading.</em>
        </h2>
        <p>
          These general articles complement this destination’s sourced notes
          above.
        </p>
        <AdviceLinks />
      </section>
    </section>
  );
}

export function TravelAdviceArticle({ slug }: { slug: string }) {
  const article = adviceArticle(slug);
  if (!article)
    return (
      <section className="page empty">
        <h1>Travel advice not found.</h1>
        <Link href="/explore/advice">Browse travel advice</Link>
      </section>
    );
  return (
    <article className="page section travel-advice-article">
      <Link className="breadcrumb" href="/explore/advice">
        <ArrowLeft size={15} /> Explore / Travel advice
      </Link>
      <span className="eyebrow">FIELD NOTES / PLANNING CHECKLIST</span>
      <h1 className="page-title">{article.title}</h1>
      <p className="lede">{article.summary}</p>
      <div className="advice-article-layout">
        <div>
          {article.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </section>
          ))}
        </div>
        <aside className="paper-note">
          <h2>About this guide</h2>
          <p>{article.basis}</p>
          <p>
            Planning suggestions, not current fares, schedules or an assessment
            of your entry requirements.
          </p>
          <AdvisorySources links={article.resources} />
          <SourceReviewNote />
          <Link className="button secondary" href="/planner">
            Plan a Trip <ArrowUpRight size={16} />
          </Link>
        </aside>
      </div>
      <nav className="explore-advice-preview" aria-label="More travel advice">
        <AdviceLinks />
      </nav>
    </article>
  );
}

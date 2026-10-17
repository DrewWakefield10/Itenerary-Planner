"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Sparkles,
  MapPin,
  Wallet,
  Users,
  Calendar,
  LoaderCircle,
} from "lucide-react";
import {
  destinations,
  personalities,
  peso,
  destination,
} from "@/lib/destinations";
import {
  defaultRequest,
  requestSchema,
  tripSchema,
  tomorrow,
  type TripRequest,
} from "@/lib/trip";
import { totalBudget, recommendDestinations, travelers } from "@/lib/engine";
import { readLocal, writeLocal } from "@/lib/storage";
import { saveTrip } from "@/lib/trip-storage";
const steps = [
  "The basics",
  "Your travel style",
  "Your budget",
  "Your pace",
  "The little details",
  "Ready to wander",
];
export default function Planner() {
  const router = useRouter();
  const [r, setR] = useState<TripRequest>(defaultRequest);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [draftSaved,setDraftSaved] = useState(false);
  const [mode, setMode] = useState("demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const saved = readLocal<TripRequest>("draft", {
      ...defaultRequest,
      startDate: tomorrow(),
      pace: readLocal("preferred-pace", "Balanced"),
    });
    const q = new URLSearchParams(location.search);
    const picks = q
      .get("destinations")
      ?.split(",")
      .filter((s) => destination(s));
    if (picks?.length) saved.destinations = picks;
    const days = Number(q.get("days"));
    if (days >= 2 && days <= 21) saved.days = days;
    setR(saved);
    setLoaded(true);
    fetch("/api/generate")
      .then((r) => r.json() as Promise<{ mode: string }>)
      .then((x) => setMode(x.mode))
      .catch(() => setMode("demo"));
  }, []);
  useEffect(() => {
    if (loaded) setDraftSaved(writeLocal("draft", r));
  }, [r, loaded]);
  function change<K extends keyof TripRequest>(key: K, value: TripRequest[K]) {
    setR({ ...r, [key]: value });
    setError("");
  }
  function next() {
    const parsed = requestSchema.safeParse(r);
    if (step === 0 && !parsed.success) {
      const e = parsed.error.issues.filter((i) =>
        [
          "departure",
          "destinations",
          "startDate",
          "days",
          "adults",
          "children",
        ].includes(String(i.path[0])),
      );
      if (e.length) {
        setError(e.map((x) => x.message).join(" "));
        return;
      }
    }
    if (
      step === 2 &&
      (!Number.isInteger(r.budget) || r.budget < 500 || r.budget > 2000000)
    ) {
      setError("Choose a budget from ₱500 to ₱2,000,000.");
      return;
    }
    setStep(step + 1);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function generate(demo = false) {
    const parsed = requestSchema.safeParse(r);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: r, demo }),
        signal: AbortSignal.timeout(35000),
      });
      const data = (await res.json()) as { error?: string; trip: unknown };
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      const trip = tripSchema.parse(data.trip);
      if (!saveTrip(trip))
        throw new Error(
          "This browser could not save the itinerary. Enable local storage and retry.",
        );
      router.push(`/trips/${trip.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Generation failed. Your draft is saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page section planner-page">
      <span className="eyebrow">A BLANK PAGE. A WHOLE LOT OF POSSIBILITY.</span>
      <h1 className="page-title">
        Let’s write <em>your next story.</em>
      </h1>
      <p className="lede">
        A few little details. An adventure that feels like you.
      </p>
      <div className="planner-layout">
        <aside className="planner-sidebar">
          <ol>
            {steps.map((s, i) => (
              <li
                className={i === step ? "current" : i < step ? "complete" : ""}
                key={s}
              >
                <button disabled={i > step || busy} onClick={() => setStep(i)}>
                  <span>
                    {i < step ? (
                      <Check size={15} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <div className="sidebar-note">
            <Compass size={27} />
            <span className="handwritten">
              The best trips begin
              <br />
              with a little curiosity.
            </span>
            <p>
              {mode === "demo"
                ? "Demo mode is ready. Your plan uses curated places and estimated allowances."
                : "AI personalizes your journal; the itinerary engine handles seed activities, schedules, and estimates."}
            </p>
          </div>
        </aside>
        <div className="planner-paper">
          <div className="paper-top">
            <span>CHAPTER {String(step + 1).padStart(2, "0")} OF 06</span>
            <span>
              {loaded ? draftSaved ? "Draft saved on this browser" : "Draft could not be saved" : "Opening your journal…"}
            </span>
          </div>
          {step === 0 && (
            <>
              <h2>
                Where are we <em>headed?</em>
              </h2>
              <p>
                Choose up to three destinations. Multi-stop trips need time for
                connections.
              </p>
              <div className="form-grid">
                <label>
                  Departure city
                  <input
                    value={r.departure}
                    maxLength={80}
                    onChange={(e) => change("departure", e.target.value)}
                  />
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    value={r.startDate}
                    onChange={(e) => change("startDate", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Number of days
                  <input
                    type="number"
                    min={2}
                    max={21}
                    value={r.days}
                    onChange={(e) => change("days", Number(e.target.value))}
                  />
                </label>
                <div className="form-grid compact">
                  <label>
                    Adults
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={r.adults}
                      onChange={(e) => change("adults", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Children
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={r.children}
                      onChange={(e) =>
                        change("children", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="label-row">
                <label>Your destinations, in visit order</label>
                <button
                  className="text-link plain-button"
                  onClick={() => {
                    const d = recommendDestinations(
                      r.interests,
                      totalBudget(r) / travelers(r),
                    )[0];
                    setR({ ...r, destinations: [d.slug], days: d.days });
                  }}
                >
                  <Sparkles size={15} /> Surprise me
                </button>
              </div>
              <div className="destination-choices">
                {destinations.map((d) => (
                  <button
                    aria-pressed={r.destinations.includes(d.slug)}
                    className={
                      r.destinations.includes(d.slug) ? "selected" : ""
                    }
                    key={d.slug}
                    onClick={() => {
                      const picks = r.destinations.includes(d.slug)
                        ? r.destinations.filter((x) => x !== d.slug)
                        : [...r.destinations, d.slug];
                      if (picks.length <= 3) change("destinations", picks);
                    }}
                  >
                    <img src={`/images/${d.slug}.jpg`} alt="" />
                    <span>{d.name}</span>
                    {r.destinations.includes(d.slug) && (
                      <b>{r.destinations.indexOf(d.slug) + 1}</b>
                    )}
                  </button>
                ))}
              </div>
              <p className="fine-print">
                Arrival and departure buffers are included. A full connection
                day is reserved between destinations; transport must be verified
                separately.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <h2>
                What makes you <em>feel alive?</em>
              </h2>
              <p>
                Pick a few favorites. We’ll use them to prioritize your stops.
              </p>
              <div className="choice-grid interests">
                {personalities.map((p, i) => (
                  <button
                    className={r.interests.includes(p) ? "selected" : ""}
                    aria-pressed={r.interests.includes(p)}
                    key={p}
                    onClick={() =>
                      change(
                        "interests",
                        r.interests.includes(p)
                          ? r.interests.filter((x) => x !== p)
                          : [...r.interests, p],
                      )
                    }
                  >
                    <span className="choice-symbol">
                      {["☀", "△", "♨", "⌂", "↗", "❋", "◇", "≈", "✧"][i]}
                    </span>
                    {p}
                    {r.interests.includes(p) && <Check size={15} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>
                Big memories.
                <br />
                <em>Your kind of budget.</em>
              </h2>
              <p>
                Every amount is in Philippine pesos. We’ll keep the arithmetic
                honest.
              </p>
              <div className="chips">
                {(
                  [
                    "Backpacker",
                    "Budget",
                    "Comfortable",
                    "Premium",
                    "Custom",
                  ] as const
                ).map((t) => (
                  <button
                    className={r.tier === t ? "selected" : ""}
                    key={t}
                    onClick={() => {
                      const amounts = {
                        Backpacker: 1300,
                        Budget: 1800,
                        Comfortable: 3000,
                        Premium: 6500,
                        Custom: 0,
                      };
                      setR({
                        ...r,
                        tier: t,
                        budget:
                          t === "Custom"
                            ? r.budget
                            : amounts[t] *
                              r.days *
                              (r.budgetMode === "total" ? travelers(r) : 1),
                      });
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="form-grid">
                <label>
                  Budget amount (₱)
                  <input
                    type="number"
                    min={500}
                    max={2000000}
                    step={1}
                    value={r.budget}
                    onChange={(e) => change("budget", Number(e.target.value))}
                  />
                </label>
                <label>
                  This amount is
                  <select
                    value={r.budgetMode}
                    onChange={(e) =>
                      change(
                        "budgetMode",
                        e.target.value as TripRequest["budgetMode"],
                      )
                    }
                  >
                    <option value="total">For the whole group</option>
                    <option value="person">Per person</option>
                  </select>
                </label>
                <label>
                  Emergency reserve (%)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={r.reserve}
                    onChange={(e) => change("reserve", Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={r.flights}
                  onChange={(e) => change("flights", e.target.checked)}
                />
                Include a provisional return-flight allowance (₱7,000/person,
                not a quote)
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={r.accommodation}
                  onChange={(e) => change("accommodation", e.target.checked)}
                />
                Include accommodation for {r.days - 1} nights
              </label>
              <div className="budget-ticket">
                <Wallet size={24} />
                <div>
                  <small>YOUR GROUP’S PLANNING LIMIT</small>
                  <strong>{peso(totalBudget(r))}</strong>
                </div>
                <span>
                  including{" "}
                  {peso(Math.round((totalBudget(r) * r.reserve) / 100))} reserve
                </span>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>
                Leave room to <em>breathe.</em>
              </h2>
              <p>How full should your days feel?</p>
              <div className="pace-choices">
                {[
                  [
                    "Chill",
                    "Slow mornings, one main stop, and a generous rest.",
                  ],
                  [
                    "Balanced",
                    "A couple of nearby discoveries, with time in between.",
                  ],
                  ["Packed", "Up to three nearby stops when the day allows."],
                ].map(([p, desc]) => (
                  <button
                    key={p}
                    className={r.pace === p ? "selected" : ""}
                    onClick={() => change("pace", p as TripRequest["pace"])}
                  >
                    <span className="choice-symbol">
                      {p === "Chill" ? "≈" : p === "Balanced" ? "☀" : "↗"}
                    </span>
                    <span>
                      <h3>{p}</h3>
                      <p>{desc}</p>
                    </span>
                    {r.pace === p && <Check size={20} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2>
                It’s the little things
                <br />
                <em>that make it yours.</em>
              </h2>
              <p>
                Optional details. Saved with your trip; local suitability and
                bookings need confirmation.
              </p>
              <div className="form-grid">
                {(
                  [
                    ["diet", "Dietary requirements"],
                    ["accessibility", "Accessibility needs"],
                    ["stay", "Accommodation preference"],
                    ["avoid", "Activities to avoid"],
                    ["must", "Must-visit attractions"],
                    ["reservations", "Confirmed reservations"],
                    ["requirements", "Other travel requirements"],
                  ] as [keyof TripRequest, string][]
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <textarea
                      maxLength={
                        key === "reservations"
                          ? 1000
                          : key === "stay"
                            ? 200
                            : 500
                      }
                      value={String(r[key])}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p className="fine-print">
                For exact booked times, add and lock the reservation in your
                generated itinerary. Free-text reservations are retained as
                notes, not automatically scheduled.
              </p>
            </>
          )}
          {step === 5 && (
            <>
              <h2>
                Your next chapter
                <br />
                <em>is almost here.</em>
              </h2>
              <div className="review-list">
                <div>
                  <MapPin />
                  <span>
                    YOUR PLACES
                    <strong>
                      {r.destinations
                        .map((s) => destination(s)?.name)
                        .join(" → ")}
                    </strong>
                  </span>
                </div>
                <div>
                  <Calendar />
                  <span>
                    YOUR TIME
                    <strong>
                      {r.days} days from {r.startDate}
                    </strong>
                  </span>
                </div>
                <div>
                  <Users />
                  <span>
                    YOUR PEOPLE
                    <strong>
                      {r.adults} adults · {r.children} children · {r.pace} pace
                    </strong>
                  </span>
                </div>
                <div>
                  <Wallet />
                  <span>
                    YOUR BUDGET
                    <strong>
                      {peso(totalBudget(r))} total · {r.reserve}% reserve
                    </strong>
                  </span>
                </div>
              </div>
              <div className="notice">
                {mode === "demo"
                  ? "Demo generation: curated seed activities, deterministic schedules, and estimated costs. No live AI or bookings are connected."
                  : "AI personalizes journal themes and notes. Activities and prices stay grounded in seed data and need verification."}
              </div>
            </>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="planner-actions">
            <button
              className="text-link plain-button"
              disabled={step === 0 || busy}
              onClick={() => {
                setStep(step - 1);
                setError("");
              }}
            >
              <ArrowLeft size={17} />
              Back
            </button>
            {step < 5 ? (
              <button className="button" disabled={!loaded} onClick={next}>
                Next chapter <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() => generate()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}{" "}
                {busy
                  ? "Building your itinerary…"
                  : mode === "demo"
                    ? "Generate demo itinerary"
                    : "Generate my itinerary"}
              </button>
            )}
          </div>
          {busy && (
            <p role="status" className="fine-print">
              {mode === "demo"
                ? "Selecting nearby stops and checking your budget."
                : "Requesting journal personalization and validating the response."}
            </p>
          )}
          {error && step === 5 && (
            <button
              className="text-link plain-button"
              disabled={busy}
              onClick={() => generate(true)}
            >
              Try deterministic demo mode instead
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

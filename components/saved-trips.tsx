"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, ArrowUpRight, Copy, Trash2 } from "lucide-react";
import { tripSchema, type Trip } from "@/lib/trip";
import { readTrips, saveTrip, deleteTrip } from "@/lib/trip-storage";
import { budgetSummary, uid } from "@/lib/engine";
import { peso } from "@/lib/destinations";
export default function SavedTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => setTrips(readTrips()), []);
  return (
    <section className="page section">
      <span className="eyebrow">KEEP THE PLANS. COLLECT THE MEMORIES.</span>
      <div className="section-heading">
        <h1 className="page-title">
          Your travel <em>journal.</em>
        </h1>
        <Link href="/planner" className="button">
          A new adventure <ArrowUpRight size={17} />
        </Link>
      </div>
      <p className="lede">
        Saved on this browser. Your next chapter is waiting.
      </p>
      <label className="backup-import">Restore a Lakbay JSON backup
        <input type="file" accept="application/json,.json" onChange={async e=>{
          const file=e.target.files?.[0]; if(!file)return;
          try {
            if(file.size>1000000)throw new Error('Backup must be smaller than 1 MB.');
            const parsed=tripSchema.safeParse(JSON.parse(await file.text()));
            if(!parsed.success)throw new Error('This file is not a valid Lakbay itinerary.');
            const restored={...parsed.data,id:uid(),title:parsed.data.title.slice(0,145)+' (restored)'};
            if(!saveTrip(restored))throw new Error('Could not save the restored trip.');
            setTrips(readTrips());setMessage('Backup restored as a new trip.');
          }catch(error){setMessage(error instanceof Error?error.message:'Backup could not be read.');}
          e.target.value='';
        }}/>
      </label>
      {message&&<p className="notice" role="status">{message}</p>}
      {trips.length === 0 ? (
        <div className="empty">
          <BookOpen size={42} />
          <h2>Every story starts with a blank page.</h2>
          <p>Plan your first adventure and it will appear here.</p>
          <Link className="button" href="/planner">
            Plan my adventure
          </Link>
        </div>
      ) : (
        <div className="destination-grid">
          {trips.map((t) => (
            <article className="postcard" key={t.id}>
              <Link href={`/trips/${t.id}`}>
                <img
                  src={`/images/${t.request.destinations[0]}.jpg`}
                  alt="Trip destination"
                />
              </Link>
              <div className="postcard-body">
                <span className="eyebrow">
                  {t.days.length} DAYS · {t.mode.toUpperCase()} PLAN
                </span>
                <Link href={`/trips/${t.id}`}>
                  <h3>{t.title}</h3>
                </Link>
                <p>
                  {t.request.startDate} · {peso(budgetSummary(t).total)}{" "}
                  estimated
                </p>
                <div className="trip-card-actions">
                  <Link className="text-link" href={`/trips/${t.id}`}>
                    Open journal <ArrowUpRight size={15} />
                  </Link>
                  <button
                    className="icon-button"
                    aria-label={`Duplicate ${t.title}`}
                    onClick={() => {
                      const copy = {
                        ...structuredClone(t),
                        id: uid(),
                        title: `${t.title.slice(0,150)} (copy)`,
                        createdAt: new Date().toISOString(),
                      };
                      if (saveTrip(copy)) setTrips(readTrips());
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${t.title}`}
                    onClick={() => {
                      if (
                        confirm(`Delete “${t.title}” from this browser?`) &&
                        deleteTrip(t.id)
                      )
                        setTrips(readTrips());
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function EventPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("PUBLISHED");

  useEffect(() => {
    fetch(`${API_BASE}/api/events?status=${filter}&per_page=50`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []));
  }, [filter]);

  const statusBadge = (status: string) => {
    const cssMap: Record<string, string> = {
      DRAFT: "background:rgba(255,255,255,0.08);color:var(--color-text-secondary)",
      PUBLISHED: "background:rgba(0,232,123,0.15);border:1px solid rgba(0,232,123,0.3);color:var(--color-green-neon)",
      DONE: "background:rgba(255,255,255,0.06);color:var(--color-text-tertiary)",
    };
    return <span dangerouslySetInnerHTML={{ __html: `<span style="${cssMap[status] || cssMap.DRAFT};padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.75rem;font-weight:600">${status}</span>` }} />;
  };

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 fade-in">
        <h1 className="heading-display text-3xl md:text-4xl mb-2">Event</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "2rem" }}>Daftar event mendatang dan yang lalu.</p>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {[["PUBLISHED", "Akan Datang"], ["DONE", "Sudah Lewat"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: "0.5rem 1.25rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: 500,
              border: filter === val ? "1px solid rgba(0,232,123,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: filter === val ? "rgba(0,232,123,0.15)" : "rgba(255,255,255,0.04)",
              color: filter === val ? "var(--color-green-neon)" : "var(--color-text-secondary)",
              cursor: "pointer", transition: "all 0.2s ease",
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Event list */}
        {events.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p style={{ color: "var(--color-text-secondary)" }}>Tidak ada event.</p>
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="glass-panel-lg p-6 mb-4">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.25rem" }}>{e.title}</h3>
                {statusBadge(e.status)}
              </div>
              {e.tagline && <p style={{ color: "var(--color-green-neon)", fontWeight: 500, marginBottom: "0.5rem" }}>{e.tagline}</p>}
              {e.description && <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>{e.description.substring(0, 200)}{e.description.length > 200 ? "..." : ""}</p>}
              <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>
                {new Date(e.startAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              {e.status !== "DONE" && (
                <Link href={getToken() ? "/dashboard" : "/login?next=/dashboard"} className="btn-glass-primary" style={{ marginTop: "1rem", display: "inline-block", padding: "0.6rem 1.5rem", fontSize: "0.85rem" }}>
                  I&apos;M ATTENDING
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}

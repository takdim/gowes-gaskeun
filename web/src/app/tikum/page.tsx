"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MapComponent from "@/components/MapComponent";

import { API_BASE } from "@/lib/api";

export default function TikumPage() {
  const [tikums, setTikums] = useState<any[]>([]);
  const [eventReady, setEventReady] = useState(false);

  useEffect(() => {
    // Get featured event id first
    fetch(`${API_BASE}/api/events/featured`)
      .then((res) => res.json())
      .then((data) => {
        if (data.event?.id) {
          setEventReady(true);
          fetch(`${API_BASE}/api/tikums?event_id=${data.event.id}`)
            .then((res) => res.json())
            .then((d) => setTikums(d.tikums || []));
        } else {
          setEventReady(true);
        }
      });
  }, []);

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 fade-in">
        <h1 className="heading-display text-3xl md:text-4xl mb-2">Titik Kumpul (Tikum)</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "2rem" }}>Pilih titik kumpul terdekat dari lokasimu.</p>

        {eventReady && tikums.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p style={{ color: "var(--color-text-secondary)" }}>Belum ada Tikum yang ditetapkan.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 mb-8">
              {tikums.map((t: any) => (
                <div key={t.id} className="glass-panel p-5" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h3 style={{ fontWeight: 700, color: "var(--color-purple-tikum)" }}>{t.name}</h3>
                    {t.meetTime && <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>Jam kumpul: {t.meetTime}</p>}
                    <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>{t.attendeeCount ?? 0} peserta terdaftar</p>
                  </div>
                  <a href={`https://www.google.com/maps?q=${t.lat},${t.lng}`} target="_blank" rel="noopener" className="btn-glass-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                    📍 Lihat Lokasi
                  </a>
                </div>
              ))}
            </div>

            {tikums.length > 0 && (
              <div className="glass-panel overflow-hidden" style={{ maxHeight: "350px" }}>
                <MapComponent
                  markers={tikums.map((t: any) => ({ lat: t.lat, lng: t.lng, label: `${t.name} (${t.attendeeCount ?? 0})`, color: "#a78bfa" })) as any}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

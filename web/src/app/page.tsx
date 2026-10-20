"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MapComponent from "@/components/MapComponent";
import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function HomePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getToken()));
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/events/featured`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (active) {
          setData(json);
          setError("");
        }
      } catch {
        if (active) setError("Server event belum tersedia. Jalankan backend di port 5001.");
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!data?.event?.startAt) return;

    const target = new Date(data.event.startAt).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data?.event?.startAt]);

  const mapsUrl = (lat: number, lng: number, label: string) =>
    `https://www.google.com/maps?q=${lat},${lng}+(${encodeURIComponent(label)})`;

  const mapMarkers = useMemo<any[]>(() => {
    if (!data) return [];
    return [
      data.start && { lat: data.start.lat, lng: data.start.lng, label: "START", color: "#a78bfa" },
      data.finish && { lat: data.finish.lat, lng: data.finish.lng, label: "FINISH", color: "#f43f5e" },
      ...(data.tikums ?? []).map((t: any) => ({
        lat: t.lat,
        lng: t.lng,
        label: `${t.name} (${t.attendee_count ?? 0})`,
        color: "#a78bfa",
      })),
    ].filter(Boolean);
  }, [data]);

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      {/* Hero Section */}
      <section className="px-4 py-12 md:py-20 fade-in">
        <div className="max-w-4xl mx-auto text-center">
          {error && (
            <div className="glass-panel p-4 mb-6" role="alert" style={{ color: "#fbbf24" }}>
              {error}
            </div>
          )}
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="badge-live">Rutin</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>Jumat terakhir setiap bulan</span>
          </div>

          {/* Title */}
          {data?.event ? (
            <>
              <h1 className="heading-display text-4xl md:text-6xl lg:text-7xl mb-4">
                {data.event.title}
              </h1>
              <p className="text-xl md:text-2xl mb-2" style={{ color: "var(--color-green-neon)" }}>
                {data.event.tagline}
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>
                {new Date(data.event.startAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </>
          ) : (
            <>
              <h1 className="heading-display text-4xl md:text-6xl mb-4">
                Critical Mass Makassar
              </h1>
              <p className="text-xl md:text-2xl mb-2" style={{ color: "var(--color-green-neon)" }}>
                Gaskeun, Kuasai Jalan Bareng!
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>Bergerak Bersama, Merayakan Kota</p>
            </>
          )}

          {/* Status label */}
          {data?.event && data.event.status === "PUBLISHED" && (
            <div className="inline-block badge-live mb-6" style={{ padding: "0.5rem 1.25rem", fontSize: "0.9rem" }}>
              Sedang Berlangsung
            </div>
          )}

          {/* Countdown */}
          {(data?.event?.status !== "DONE") && (
            <div className="flex justify-center gap-3 md:gap-6 mb-10">
              {[
                { value: countdown.days, label: "Hari" },
                { value: countdown.hours, label: "Jam" },
                { value: countdown.minutes, label: "Menit" },
                { value: countdown.seconds, label: "Detik" },
              ].map((item) => (
                <div key={item.label} className="countdown-box glass-panel" style={{ padding: "0.75rem 0.5rem", minWidth: "60px" }}>
                  <span className="countdown-value">{String(item.value).padStart(2, "0")}</span>
                  <span className="countdown-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 mb-10 max-w-lg mx-auto">
            <div className="stat-card glass-panel">
              <div className="stat-value">{data?.stats?.totalAttending ?? 0}</div>
              <div className="stat-label">Riders Attending</div>
            </div>
            <div className="stat-card glass-panel">
              <div className="stat-value">{data?.tikums?.length ?? 0}</div>
              <div className="stat-label">Tikum Peserta</div>
            </div>
            <div className="stat-card glass-panel">
              <div className="stat-value" style={{ color: "var(--color-green-neon)" }}>{data?.stats?.onTheWay ?? 0}</div>
              <div className="stat-label">On The Way</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-12">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login?next=/dashboard"}
              className="btn-glass-primary"
              style={{ minWidth: "200px" }}
            >
              🚲 I&apos;M ATTENDING
            </Link>
            <Link href="/live" className="btn-glass-secondary" style={{ minWidth: "200px" }}>
              📍 LIHAT LIVE MAP
            </Link>
          </div>

          {/* Location Cards */}
          {(data?.start || data?.finish) && (
            <div className="grid md:grid-cols-2 gap-4 mb-10 max-w-2xl mx-auto text-left">
              {data.start && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: "1.5rem" }}>🟣</span>
                    <h3 style={{ fontWeight: 700 }}>Titik Kumpul Utama / Start</h3>
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--color-purple-tikum)" }}>{data.start.name}</p>
                  {data.start.time && <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>{data.start.time}</p>}
                  {data.start.description && <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{data.start.description}</p>}
                  <a href={mapsUrl(data.start.lat, data.start.lng, data.start.name)} target="_blank" rel="noopener" className="btn-glass-secondary" style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                    🗺️ Lihat di Maps
                  </a>
                </div>
              )}
              {data.finish && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: "1.5rem" }}>🔴</span>
                    <h3 style={{ fontWeight: 700 }}>Official Finish</h3>
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--color-red-finish)" }}>{data.finish.name}</p>
                  {data.finish.time && <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>{data.finish.time}</p>}
                  {data.finish.description && <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{data.finish.description}</p>}
                  <a href={mapsUrl(data.finish.lat, data.finish.lng, data.finish.name)} target="_blank" rel="noopener" className="btn-glass-secondary" style={{ marginTop: "0.75rem", display: "inline-block", padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                    🗺️ Lihat di Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Compact Map */}
          {mapMarkers.length > 0 && (
            <div className="glass-panel overflow-hidden" style={{ maxHeight: "400px" }}>
              <MapComponent markers={mapMarkers as any} showLegend />
            </div>
          )}

          {/* Empty state */}
          {!data?.hasActive && !data?.event && (
            <div className="glass-panel p-8 text-center">
              <p style={{ color: "var(--color-text-secondary)" }}>Belum ada event terjadwal.</p>
              <p style={{ color: "var(--color-text-tertiary)", marginTop: "0.5rem", fontSize: "0.9rem" }}>Event berikutnya akan segera diumumkan!</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

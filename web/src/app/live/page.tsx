"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import io from "socket.io-client";
import L from "leaflet";
import Navbar from "@/components/Navbar";
import MapComponent from "@/components/MapComponent";

import { API_BASE } from "@/lib/api";
import { getAuthHeaders, getToken } from "@/lib/auth";

interface Rider {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  updatedAt: string;
}

export default function LiveMapPage() {
  const [event, setEvent] = useState<any>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [status, setStatus] = useState<"IDLE" | "ON_THE_WAY" | "FINISHED">("IDLE");
  const [isConnected, setIsConnected] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const socketRef = useRef<any>(null);
  const mapMarkersRef = useRef<L.Marker[]>([]);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const eventId = event?.event?.id;

  // Load event data
  useEffect(() => {
    fetch(`${API_BASE}/api/events/featured`)
      .then((res) => res.json())
      .then(setEvent);
  }, []);

  // Set up Socket.IO connection
  useEffect(() => {
    if (!eventId) return;

    const socket = io(API_BASE, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("subscribe-event", { eventId });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("position", (data: any) => {
      setRiders((prev) => {
        const idx = prev.findIndex((r) => r.userId === data.userId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return [...prev, data as Rider];
      });
    });

    socket.on("user-status", (data: any) => {
      setRiders((prev) => {
        const idx = prev.findIndex((r) => r.userId === data.userId);
        if (idx >= 0 && data.status !== "ON_THE_WAY") {
          return prev.filter((_, i) => i !== idx);
        }
        return prev;
      });
    });

    socket.on("user-left", (data: any) => {
      setRiders((prev) => prev.filter((r) => r.userId !== data.userId));
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId]);

  // Get initial riders list
  useEffect(() => {
    if (!eventId) return;
    fetch(`${API_BASE}/api/live/riders?event_id=${eventId}`)
      .then((res) => res.json())
      .then((data) => setRiders(data.riders || []));
  }, [eventId]);

  // Handle ON THE WAY
  const startTracking = async () => {
    if (!getToken()) {
      window.location.href = "/login?next=/live";
      return;
    }
    if (!navigator.geolocation) {
      setErrorMsg("Browser tidak mendukung GPS");
      return;
    }

    // Request permission first
    const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    if (permission.state === "denied") {
      setErrorMsg("Izin lokasi ditolak. Aktifkan di pengaturan browser.");
      return;
    }

    try {
      // Start API tracking
      const response = await fetch(`${API_BASE}/api/live/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ eventId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMsg(data.error || "Gagal memulai tracking");
        return;
      }
    } catch {
      console.error("Failed to start tracking");
    }

    setStatus("ON_THE_WAY");

    // Watch position
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const selfId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
        const selfName = (typeof window !== "undefined" ? localStorage.getItem("displayName") : null) || "Kamu";

        // Optimistically update riders list with self coordinates
        setRiders((prev) => {
          const idx = prev.findIndex((r) => r.userId === selfId);
          const current: Rider = {
            userId: selfId || "self",
            displayName: selfName,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed ?? undefined,
            heading: pos.coords.heading ?? undefined,
            accuracy: pos.coords.accuracy ?? undefined,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...current };
            return updated;
          }
          return [...prev, current];
        });

        // Send position
        fetch(`${API_BASE}/api/live/position`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "X-User-Id": localStorage.getItem("userId") || "",
          },
          body: JSON.stringify({
            eventId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            accuracy: pos.coords.accuracy,
          }),
        }).catch(console.error);
      },
      (err) => {
        setErrorMsg("GPS tidak tersedia atau izin ditolak");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    setWatchId(id);
  };

  // Stop tracking
  const stopTracking = async () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    try {
      await fetch(`${API_BASE}/api/live/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ eventId }),
      });
    } catch {
      console.error("Failed to stop tracking");
    }

    setStatus("FINISHED");
    setRiders((prev) => prev.filter((r) => r.userId !== localStorage.getItem("userId")));
  };

  // Build markers for map
  const allMarkers = (() => {
    const m: any[] = [];
    if (event?.start) m.push({ lat: event.start.lat, lng: event.start.lng, label: `START: ${event.start.name}`, color: "#a78bfa" });
    if (event?.finish) m.push({ lat: event.finish.lat, lng: event.finish.lng, label: `FINISH: ${event.finish.name}`, color: "#f43f5e" });
    event?.tikums?.forEach((t: any) => {
      m.push({ lat: t.lat, lng: t.lng, label: `${t.name} (${t.attendeeCount ?? 0})`, color: "#a78bfa" });
    });
    const selfId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const selfStoredName = typeof window !== "undefined" ? localStorage.getItem("displayName") : null;

    // Add rider markers - filter out self if IDLE
    if (status === "ON_THE_WAY") {
      // Show all riders except self first, then add self on top
      const others = riders.filter((r) => r.userId !== selfId);
      const self = riders.find((r) => r.userId === selfId);
      others.forEach((r) => {
        const name = (r.displayName && r.displayName !== "undefined") ? r.displayName : "Rider";
        m.push({ lat: r.lat, lng: r.lng, label: `🚲 ${name}`, color: "#00e87b" });
      });
      if (self) {
        const myName = (self.displayName && self.displayName !== "undefined") ? self.displayName : (selfStoredName || "Kamu");
        m.push({ lat: self.lat, lng: self.lng, label: `⭐ KAMU: ${myName}`, color: "#00e87b" });
      }
    } else {
      riders.forEach((r) => {
        const isSelf = r.userId === selfId;
        const name = (r.displayName && r.displayName !== "undefined")
          ? r.displayName
          : (isSelf ? (selfStoredName || "Kamu") : "Rider");
        const label = isSelf ? `⭐ KAMU: ${name}` : `🚲 ${name}`;
        m.push({ lat: r.lat, lng: r.lng, label, color: "#00e87b" });
      });
    }
    return m;
  })();

  const activeCount = riders.length;

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="fade-in">
        {/* Header */}
        <div style={{ padding: "0 1rem 1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <h1 className="heading-display text-2xl md:text-3xl">Live Map</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span className="badge-live">{activeCount} Rider Aktif</span>
              <span style={{ fontSize: "0.8rem", color: isConnected ? "var(--color-green-neon)" : "var(--color-red-finish)", fontWeight: 500 }}>
                {isConnected ? "Tersambung Realtime" : "Terputus"}
              </span>
            </div>
          </div>

          {/* Status Bar */}
          <div className="glass-panel p-4 mt-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.5rem" }}>
            {[
              { label: "On The Way", value: status === "ON_THE_WAY" ? "✅" : "—", color: "var(--color-green-neon)" },
              { label: "Finish", value: status === "FINISHED" ? "✅" : "—", color: "var(--color-pink-accent)" },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: "center", fontSize: "0.85rem" }}>
                <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
                <div style={{ color: "var(--color-text-tertiary)", fontSize: "0.75rem" }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Warning */}
          <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.8rem", marginTop: "0.75rem" }}>
            ⚠️ Lokasi live hanya bekerja saat halaman aktif. Pastikan GPS dan koneksi internet menyala.
          </p>

          {/* My GPS Card */}
          <div className="glass-panel p-4 mt-3" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>GPS Saya</div>
              <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>
                {status === "ON_THE_WAY" ? (
                  <span style={{ color: "var(--color-green-neon)" }}>🟢 On The Way</span>
                ) : status === "FINISHED" ? (
                  <span style={{ color: "var(--color-pink-accent)" }}>🏁 Selesai</span>
                ) : (
                  <span style={{ color: "var(--color-text-secondary)" }}>⏸ Idle</span>
                )}
              </div>
            </div>
            {status === "IDLE" ? (
              <button onClick={startTracking} className="btn-glass-primary" style={{ padding: "0.6rem 1.5rem", fontSize: "0.9rem" }}>
                🚲 ON THE WAY
              </button>
            ) : status === "ON_THE_WAY" ? (
              <button onClick={stopTracking} style={{
                padding: "0.6rem 1.5rem", borderRadius: "9999px", fontSize: "0.9rem", fontWeight: 600,
                background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                color: "#f43f5e", cursor: "pointer", transition: "all 0.2s ease",
              }}>
                🏁 FINISH
              </button>
            ) : (
              <Link href="/dashboard" className="btn-glass-secondary" style={{ padding: "0.6rem 1.5rem", fontSize: "0.9rem" }}>
                ← Dashboard
              </Link>
            )}
          </div>

          {/* Error message */}
          {errorMsg && (
            <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: "12px", padding: "0.75rem", marginTop: "0.75rem", fontSize: "0.9rem" }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Two column layout: rider list + map */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "60vh" }} className="md:!grid grid-cols-[1fr_300px]">
          {/* Rider List */}
          <div className="glass-panel overflow-auto" style={{ maxHeight: "70vh", margin: "1rem", borderRadius: "24px" }}>
            <div style={{ padding: "1rem", fontWeight: 700, fontSize: "0.85rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              Rider Aktif ({riders.length})
            </div>

            {riders.length === 0 && status !== "ON_THE_WAY" ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>
                <p>Belum ada rider live.</p>
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-tertiary)", marginTop: "0.5rem" }}>Klik ON THE WAY untuk membagikan posisi.</p>
              </div>
            ) : (
              <div>
                {riders.map((r) => (
                  <div key={r.userId} style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.2s ease" }}
                       onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                       onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                        {typeof window !== "undefined" && r.userId === localStorage.getItem("userId") && "⭐ "}
                        {(r.displayName && r.displayName !== "undefined")
                          ? r.displayName
                          : (typeof window !== "undefined" && r.userId === localStorage.getItem("userId")
                            ? localStorage.getItem("displayName") || "Kamu"
                            : "Rider")}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
                        {new Date(r.updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {r.speed != null && (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-tertiary)" }}>
                        🚴 {Math.round((r.speed || 0) * 3.6)} km/h
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div style={{ height: "60vh", margin: "1rem 1rem 1rem 0", borderRadius: "24px", overflow: "hidden" }}>
            <MapComponent markers={allMarkers as any} center={event?.start ? [event.start.lat, event.start.lng] : [-5.1486, 119.4390]} showLegend />
          </div>
        </div>

        {/* Mobile: stack vertically */}
        <style>{`
          @media (max-width: 768px) {
            div[style*="grid-template-columns"] {
              grid-template-columns: 1fr !important;
            }
            .md\\!grid {
              display: block !important;
            }
          }
        `}</style>
      </div>
    </main>
  );
}

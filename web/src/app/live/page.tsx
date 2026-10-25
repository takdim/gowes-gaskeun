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

// Session route persistence helpers
const getSessionStorageKey = (eid?: string) => {
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : "";
  return `gowes_live_session_${eid || "default"}_${userId || "anon"}`;
};

interface LiveSavedSession {
  eventId: string;
  startTime: number;
  route: [number, number][];
}

const loadSavedSession = (eid?: string): LiveSavedSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getSessionStorageKey(eid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.route)) {
      return parsed as LiveSavedSession;
    }
  } catch (err) {
    console.error("Failed to parse saved live session:", err);
  }
  return null;
};

const persistSession = (eid?: string, startTime?: number | null, route?: [number, number][]) => {
  if (typeof window === "undefined" || !startTime) return;
  try {
    const data: LiveSavedSession = {
      eventId: eid || "default",
      startTime,
      route: route || [],
    };
    localStorage.setItem(getSessionStorageKey(eid), JSON.stringify(data));
  } catch (err) {
    console.error("Failed to persist live session:", err);
  }
};

const clearSavedSession = (eid?: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getSessionStorageKey(eid));
  } catch {}
};

const calculateDistanceKm = (points: [number, number][]) => {
  if (points.length < 2) return 0;
  let dist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lon1] = points[i];
    const [lat2, lon2] = points[i + 1];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    dist += R * c;
  }
  return Math.round(dist * 100) / 100;
};

const formatTimer = (totalSec: number) => {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export default function LiveMapPage() {
  const [event, setEvent] = useState<any>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [status, setStatus] = useState<"IDLE" | "ON_THE_WAY" | "FINISHED">("IDLE");
  const [isConnected, setIsConnected] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const socketRef = useRef<any>(null);
  const mapMarkersRef = useRef<L.Marker[]>([]);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const eventId = event?.event?.id;

  // Session route tracking for profile activity log (persisted in localStorage across tab/browser reload)
  const sessionRouteRef = useRef<[number, number][]>([]);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [liveRoute, setLiveRoute] = useState<[number, number][]>([]);
  const [sessionRestoredNotice, setSessionRestoredNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [savePhotoUrl, setSavePhotoUrl] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [summaryStats, setSummaryStats] = useState<{
    distanceKm: number;
    durationSeconds: number;
    avgSpeed: number;
    avgPace: string;
    coords: [number, number][];
  } | null>(null);

  // Stopwatch timer when riding
  useEffect(() => {
    if (status !== "ON_THE_WAY") {
      setElapsedSeconds(0);
      return;
    }
    const updateTimer = () => {
      if (sessionStartTimeRef.current) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)));
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status]);

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

  const sendPositionUpdate = (pos: GeolocationPosition, currentEventId: string) => {
    const selfId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const selfName = (typeof window !== "undefined" ? localStorage.getItem("displayName") : null) || "Kamu";

    // Record coordinate to session route
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const last = sessionRouteRef.current[sessionRouteRef.current.length - 1];
    if (!last || Math.abs(last[0] - lat) > 0.0001 || Math.abs(last[1] - lng) > 0.0001) {
      sessionRouteRef.current.push([lat, lng]);
      setLiveRoute([...sessionRouteRef.current]);
      persistSession(currentEventId, sessionStartTimeRef.current, sessionRouteRef.current);
    }

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

    fetch(`${API_BASE}/api/live/position`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "X-User-Id": localStorage.getItem("userId") || "",
      },
      body: JSON.stringify({
        eventId: currentEventId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        accuracy: pos.coords.accuracy,
      }),
    }).catch(console.error);
  };

  // Check user's current attendance status on page load/refresh
  useEffect(() => {
    if (!eventId) return;
    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) return;

    fetch(`${API_BASE}/api/me/attendance?event_id=${eventId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-User-Id": userId,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const myAtt = data.attendances?.find((a: any) => a.eventId === eventId);
        if (myAtt) {
          if (myAtt.status === "ON_THE_WAY") {
            setStatus("ON_THE_WAY");

            // Restore previously recorded session if browser was closed or refreshed
            const saved = loadSavedSession(eventId);
            if (saved && saved.startTime) {
              sessionStartTimeRef.current = saved.startTime;
              sessionRouteRef.current = saved.route || [];
              setLiveRoute(saved.route || []);
              if (saved.route && saved.route.length > 0) {
                setSessionRestoredNotice(
                  `Progress rute (${saved.route.length} titik) & timer gowes berhasil dipulihkan.`
                );
              }
            } else {
              sessionStartTimeRef.current = Date.now();
              sessionRouteRef.current = [];
              setLiveRoute([]);
              persistSession(eventId, sessionStartTimeRef.current, []);
            }

            if (navigator.geolocation && watchRef.current === null) {
              const id = navigator.geolocation.watchPosition(
                (pos) => sendPositionUpdate(pos, eventId),
                () => {},
                { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
              );
              watchRef.current = id;
              setWatchId(id);
            }
          } else if (myAtt.status === "FINISHED") {
            setStatus("FINISHED");
            clearSavedSession(eventId);
          }
        }
      })
      .catch(console.error);
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
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (permission.state === "denied") {
        setErrorMsg("Izin lokasi ditolak. Aktifkan di pengaturan browser.");
        return;
      }
    } catch {}

    try {
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

    sessionRouteRef.current = [];
    sessionStartTimeRef.current = Date.now();
    setLiveRoute([]);
    setSessionRestoredNotice(null);
    persistSession(eventId, sessionStartTimeRef.current, []);
    setStatus("ON_THE_WAY");
    setErrorMsg("");

    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => sendPositionUpdate(pos, eventId),
      () => {
        setErrorMsg("GPS tidak tersedia atau izin ditolak");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    watchRef.current = id;
    setWatchId(id);
  };

  // Stop tracking
  const stopTracking = async () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setWatchId(null);
    setStatus("FINISHED");

    const selfId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    setRiders((prev) => prev.filter((r) => r.userId !== selfId));

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

      const res = await fetch(`${API_BASE}/api/live/riders?event_id=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setRiders(data.riders || []);
      }
    } catch {
      console.error("Failed to stop tracking");
    }

    // Telemetry summary calculation from actual GPS session
    const points = [...sessionRouteRef.current];
    let distKm = 0;

    if (points.length >= 2) {
      for (let i = 0; i < points.length - 1; i++) {
        const [lat1, lon1] = points[i];
        const [lat2, lon2] = points[i + 1];
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distKm += R * c;
      }
      distKm = Math.round(distKm * 100) / 100;
    }

    const durationSec = sessionStartTimeRef.current
      ? Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
      : 60;

    const hours = durationSec / 3600;
    const avgSpd = distKm > 0 && hours > 0 ? Math.round((distKm / hours) * 10) / 10 : 0.0;

    let avgPace = "0:00 /km";
    if (distKm > 0) {
      const paceTotalSec = durationSec / distKm;
      const pMin = Math.floor(paceTotalSec / 60);
      const pSec = Math.round(paceTotalSec % 60);
      avgPace = `${pMin}:${pSec < 10 ? "0" : ""}${pSec} /km`;
    }

    setSummaryStats({
      distanceKm: distKm,
      durationSeconds: durationSec,
      avgSpeed: avgSpd,
      avgPace: avgPace,
      coords: points,
    });
    setSaveTitle(distKm > 0 ? `Gowes Makassar (${distKm} km)` : "Gowes Makassar");
    setShowSaveModal(true);
  };

  const handleSaveToProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryStats) return;
    setSavingActivity(true);

    try {
      const res = await fetch(`${API_BASE}/api/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({
          title: saveTitle.trim() || `Gowes Makassar #${new Date().toLocaleDateString("id-ID")}`,
          notes: saveNotes.trim(),
          distance_km: summaryStats.distanceKm,
          duration_seconds: summaryStats.durationSeconds,
          avg_speed: summaryStats.avgSpeed,
          avg_pace: summaryStats.avgPace,
          route_coordinates: summaryStats.coords,
          photos: savePhotoUrl.trim() ? [savePhotoUrl.trim()] : [],
          eventId: eventId || null,
        }),
      });

      if (res.ok) {
        clearSavedSession(eventId);
        setShowSaveModal(false);
        window.location.href = "/dashboard";
      }
    } catch {
      setErrorMsg("Gagal menyimpan aktivitas.");
    } finally {
      setSavingActivity(false);
    }
  };

  // Build markers for map
  const allMarkers = (() => {
    const m: any[] = [];
    if (event?.start) m.push({ lat: event.start.lat, lng: event.start.lng, label: `START: ${event.start.name}`, color: "#a78bfa" });
    if (event?.finish) m.push({ lat: event.finish.lat, lng: event.finish.lng, label: `FINISH: ${event.finish.name}`, color: "#f43f5e" });
    event?.tikums?.forEach((t: any) => {
      const count = t.attendeeCount ?? t.attendee_count ?? 0;
      m.push({ lat: t.lat, lng: t.lng, label: `${t.name} (${count})`, color: "#a78bfa" });
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
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={startTracking} className="btn-glass-primary" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
                  🚲 MULAI LAGI
                </button>
                <Link href="/dashboard" className="btn-glass-secondary" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
                  Dashboard
                </Link>
              </div>
            )}
          </div>

          {/* Live Telemetry HUD when ON_THE_WAY */}
          {status === "ON_THE_WAY" && (
            <div
              className="glass-panel p-4 mt-3"
              style={{
                border: "1px solid rgba(0, 232, 123, 0.35)",
                background: "linear-gradient(135deg, rgba(0,232,123,0.08) 0%, rgba(13,17,23,0.85) 100%)",
                boxShadow: "0 8px 32px rgba(0,232,123,0.1)",
              }}
            >
              {sessionRestoredNotice && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    background: "rgba(0,232,123,0.15)",
                    border: "1px solid rgba(0,232,123,0.3)",
                    borderRadius: "10px",
                    marginBottom: "0.75rem",
                    fontSize: "0.8rem",
                    color: "var(--color-green-neon)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>🔄</span>
                    <span>{sessionRestoredNotice}</span>
                  </span>
                  <button
                    onClick={() => setSessionRestoredNotice(null)}
                    style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.85rem", padding: "0 0.25rem" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Waktu Aktif</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "#ffffff", marginTop: "0.2rem" }}>
                    ⏱ {formatTimer(elapsedSeconds)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Jarak Tempuh</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--color-green-neon)", marginTop: "0.2rem" }}>
                    {calculateDistanceKm(liveRoute)} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>km</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rute Tersimpan</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "#a78bfa", marginTop: "0.2rem" }}>
                    {liveRoute.length} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>titik</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "var(--color-text-tertiary)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                <span style={{ color: "var(--color-green-neon)" }}>●</span>
                <span>Progres tersimpan otomatis di perangkat. Jika browser tertutup atau direfresh, rute akan otomatis berlanjut.</span>
              </div>
            </div>
          )}

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
                      <Link
                        href={`/profile/${r.userId}`}
                        style={{ fontWeight: 600, fontSize: "0.9rem", color: "inherit", textDecoration: "none" }}
                        className="hover:text-green-400 transition-colors"
                        title="Lihat profil & aktivitas pesepeda"
                      >
                        {typeof window !== "undefined" && r.userId === localStorage.getItem("userId") && "⭐ "}
                        {(r.displayName && r.displayName !== "undefined")
                          ? r.displayName
                          : (typeof window !== "undefined" && r.userId === localStorage.getItem("userId")
                            ? localStorage.getItem("displayName") || "Kamu"
                            : "Rider")}
                        <span style={{ fontSize: "0.75rem", color: "var(--color-green-neon)", marginLeft: "0.25rem" }}>↗</span>
                      </Link>
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
            <MapComponent
              markers={allMarkers as any}
              center={event?.start ? [event.start.lat, event.start.lng] : [-5.1486, 119.4390]}
              polyline={status === "ON_THE_WAY" && liveRoute.length >= 2 ? liveRoute : undefined}
              autoFitPolyline={false}
              showLegend
            />
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

      {/* Save Ride Modal (Adidas Running / Strava style) */}
      {showSaveModal && summaryStats && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(20px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="glass-panel-lg p-6 max-w-lg w-full"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "1.5rem" }}>🎉</span>
                <h3 className="text-xl font-bold">Gowes Selesai!</h3>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              Kerja bagus! Perjalananmu telah direkam. Simpan dan bagikan ke feed profil komunitasmu.
            </p>

            {/* Quick Telemetry Box */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "0.85rem 1rem",
                marginBottom: "1.25rem",
              }}
              className="grid grid-cols-3 gap-2 text-center"
            >
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Jarak</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-green-neon)" }}>
                  {summaryStats.distanceKm} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>km</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Avg Pace</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-purple-tikum)" }}>
                  {summaryStats.avgPace}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Avg Speed</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>
                  {summaryStats.avgSpeed} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>km/h</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveToProfile} className="space-y-4">
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                  Judul Perjalanan
                </label>
                <input
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="Judul aktivitas gowes"
                  className="input-glass w-full"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                  Foto Perjalanan (URL Foto Opsional)
                </label>
                <input
                  value={savePhotoUrl}
                  onChange={(e) => setSavePhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                  Catatan / Cerita Keseruan
                </label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Tuliskan pengalaman di jalan, tantangan, atau spot kopi..."
                  className="input-glass w-full"
                  rows={3}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearSavedSession(eventId);
                    setShowSaveModal(false);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-text-tertiary)",
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Lewati
                </button>
                <button
                  type="submit"
                  disabled={savingActivity}
                  className="btn-glass-primary"
                  style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem" }}
                >
                  {savingActivity ? "Menyimpan..." : "Posting ke Profil 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

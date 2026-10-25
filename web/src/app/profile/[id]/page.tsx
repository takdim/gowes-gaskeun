"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { API_BASE } from "@/lib/api";
import MapComponent from "@/components/MapComponent";
import { getToken } from "@/lib/auth";

interface Activity {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  title: string;
  notes?: string;
  distanceKm: number;
  durationSeconds: number;
  avgSpeed: number;
  maxSpeed?: number;
  avgPace: string;
  calories: number;
  routeCoordinates?: [number, number][];
  photos?: string[];
  kudosCount: number;
  hasKudo: boolean;
  createdAt: string;
}

interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  createdAt: string;
}

interface UserStats {
  totalDistanceKm: number;
  totalDurationSeconds: number;
  totalHours: number;
  totalRides: number;
  totalCalories: number;
  longestRideKm: number;
  avgSpeed: number;
  avgPace: string;
}

const PAGE_SIZE = 6;

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileUserId = params?.id as string;

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Pagination & Infinite Scroll states
  const [activities, setActivities] = useState<Activity[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState("");

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUserId(localStorage.getItem("userId") || "");
    }
  }, []);

  // Fetch activities batch
  const fetchActivitiesBatch = useCallback(
    async (targetOffset: number, isInitial = false) => {
      if (!profileUserId) return;
      if (!isInitial) setLoadingMore(true);

      const loggedInId = typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "";

      try {
        const res = await fetch(
          `${API_BASE}/api/activities?user_id=${profileUserId}&limit=${PAGE_SIZE}&offset=${targetOffset}`,
          { headers: { "X-User-Id": loggedInId } }
        );

        if (res.ok) {
          const data = await res.json();
          const newItems: Activity[] = data.activities || [];

          if (isInitial) {
            setActivities(newItems);
          } else {
            setActivities((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const filtered = newItems.filter((a) => !existingIds.has(a.id));
              return [...prev, ...filtered];
            });
          }

          setHasMore(data.hasMore ?? false);
          setOffset(targetOffset + newItems.length);
        }
      } catch (err) {
        console.error("Gagal memuat aktivitas:", err);
      } finally {
        setLoadingMore(false);
      }
    },
    [profileUserId]
  );

  // Initial Load
  useEffect(() => {
    if (!profileUserId) return;

    setLoading(true);
    setErrorMsg("");

    const fetchUser = fetch(`${API_BASE}/api/users/${profileUserId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Pengguna tidak ditemukan");
        return res.json();
      })
      .then(setProfile);

    const fetchStats = fetch(`${API_BASE}/api/users/${profileUserId}/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      });

    const fetchFirstBatch = fetchActivitiesBatch(0, true);

    Promise.all([fetchUser, fetchStats, fetchFirstBatch])
      .catch((err) => setErrorMsg(err.message || "Gagal memuat profil"))
      .finally(() => setLoading(false));
  }, [profileUserId, fetchActivitiesBatch]);

  // Load More Handler
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    fetchActivitiesBatch(offset, false);
  }, [hasMore, loading, loadingMore, offset, fetchActivitiesBatch]);

  // IntersectionObserver for Infinite Scroll
  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, handleLoadMore]);

  // Toggle Kudos
  const handleToggleKudos = async (activityId: string) => {
    const token = getToken();
    const myId = typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "";
    if (!token) {
      router.push(`/login?next=/profile/${profileUserId}`);
      return;
    }

    setActivities((prev) =>
      prev.map((act) => {
        if (act.id === activityId) {
          const nextHasKudo = !act.hasKudo;
          return {
            ...act,
            hasKudo: nextHasKudo,
            kudosCount: nextHasKudo ? act.kudosCount + 1 : Math.max(0, act.kudosCount - 1),
          };
        }
        return act;
      })
    );

    try {
      await fetch(`${API_BASE}/api/activities/${activityId}/kudos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Id": myId,
        },
      });
    } catch {
      console.error("Gagal memberi kudo");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}j ${remMins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  const isSelf = currentUserId && profileUserId === currentUserId;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center pt-20">
        <div style={{ color: "var(--color-green-neon)" }}>Memuat profil pesepeda...</div>
      </main>
    );
  }

  if (errorMsg || !profile) {
    return (
      <main className="min-h-screen pt-24 pb-16">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="glass-panel p-8">
            <span style={{ fontSize: "2.5rem" }}>🚴</span>
            <h2 className="text-xl font-bold mt-2">Pesepeda Tidak Ditemukan</h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
              Profil pengguna ini mungkin sudah dihapus atau tautan tidak valid.
            </p>
            <Link href="/dashboard" className="btn-glass-primary mt-4 inline-block" style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}>
              ← Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-20 pb-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 fade-in">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            style={{
              color: "var(--color-text-tertiary)",
              fontSize: "0.85rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <span>←</span>
            <span>Kembali ke Feed</span>
          </Link>
        </div>

        {/* 1. Public Profile Header */}
        <div className="glass-panel p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                style={{
                  width: "76px",
                  height: "76px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(167,139,250,0.35), rgba(0,232,123,0.35))",
                  border: "2px solid rgba(0,232,123,0.6)",
                  boxShadow: "0 0 24px rgba(0,232,123,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: "#ffffff",
                  flexShrink: 0,
                }}
              >
                {profile.displayName?.[0]?.toUpperCase() || "R"}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "9999px",
                      background: profile.role === "ADMIN" ? "rgba(244,63,94,0.2)" : "rgba(0,232,123,0.15)",
                      color: profile.role === "ADMIN" ? "#f43f5e" : "#00e87b",
                      border: profile.role === "ADMIN" ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(0,232,123,0.3)",
                    }}
                  >
                    {profile.role === "ADMIN" ? "ADMIN" : "PRO RIDER 🚴"}
                  </span>
                  {isSelf && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px",
                        background: "rgba(255,255,255,0.08)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      (Kamu)
                    </span>
                  )}
                </div>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  Pesepeda Urban Makassar • Bergabung {new Date(profile.createdAt).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

            {isSelf ? (
              <Link
                href="/dashboard"
                className="btn-glass-secondary"
                style={{ padding: "0.55rem 1.25rem", fontSize: "0.85rem", alignSelf: "flex-start" }}
              >
                ⚙️ Kelola Profilku
              </Link>
            ) : (
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Tautan profil berhasil disalin!");
                  }
                }}
                className="btn-glass-secondary"
                style={{ padding: "0.55rem 1.25rem", fontSize: "0.85rem", alignSelf: "flex-start" }}
              >
                📤 Bagikan Profil
              </button>
            )}
          </div>
        </div>

        {/* 2. Public Career Telemetry (Adidas Running style) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="glass-panel p-4 text-center">
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Jarak
            </span>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--color-green-neon)", marginTop: "0.25rem" }}>
              {stats?.totalDistanceKm || 0}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>km</span>
            </div>
          </div>

          <div className="glass-panel p-4 text-center">
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Jam
            </span>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#ffffff", marginTop: "0.25rem" }}>
              {stats?.totalHours || 0}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>jam</span>
            </div>
          </div>

          <div className="glass-panel p-4 text-center">
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Perjalanan
            </span>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#ffffff", marginTop: "0.25rem" }}>
              {stats?.totalRides || 0}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>ride</span>
            </div>
          </div>

          <div className="glass-panel p-4 text-center">
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Avg Pace
            </span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-purple-tikum)", marginTop: "0.25rem" }}>
              {stats?.avgPace || "0:00"}
            </div>
          </div>

          <div className="glass-panel p-4 text-center col-span-2 md:col-span-1">
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Kalori
            </span>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#f43f5e", marginTop: "0.25rem" }}>
              {stats?.totalCalories || 0}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>kcal</span>
            </div>
          </div>
        </div>

        {/* 3. Section Title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">
            Semua Aktivitas Gowes
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-tertiary)" }}>
            Urut dari yang terbaru
          </span>
        </div>

        {/* 4. Activities Feed by this user */}
        {activities.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <span style={{ fontSize: "2.5rem" }}>🚲</span>
            <h3 className="text-lg font-bold mt-2">Belum ada aktivitas</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              {profile.displayName} belum membagikan rekaman aktivitas perjalanan gowes.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activities.map((act) => (
              <div key={act.id} className="glass-panel-lg overflow-hidden transition-all duration-300">
                {/* Card Header */}
                <div className="p-5 pb-3 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{act.title}</h3>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginTop: "0.2rem" }}>
                      {new Date(act.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {/* Notes / Caption */}
                {act.notes && (
                  <div className="px-5 pb-3">
                    <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      {act.notes}
                    </p>
                  </div>
                )}

                {/* Polyline Route Map (Leaflet) */}
                {act.routeCoordinates && act.routeCoordinates.length > 1 && (
                  <div style={{ width: "100%", height: "240px", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <MapComponent
                      polyline={act.routeCoordinates}
                      polylineColor="#00e87b"
                      height="240px"
                      interactive={false}
                    />
                  </div>
                )}

                {/* Photos Grid if any */}
                {act.photos && act.photos.length > 0 && (
                  <div className="p-4 grid grid-cols-2 gap-2">
                    {act.photos.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          borderRadius: "14px",
                          overflow: "hidden",
                          maxHeight: "220px",
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <img
                          src={p}
                          alt="Foto Gowes"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            (e.target as any).style.display = "none";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Adidas Running / Strava Metrics Bar */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    padding: "0.85rem 1.25rem",
                  }}
                  className="grid grid-cols-4 gap-2 text-center"
                >
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Jarak</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-green-neon)" }}>
                      {act.distanceKm} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>km</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Waktu</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                      {formatDuration(act.durationSeconds)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Avg Pace</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-purple-tikum)" }}>
                      {act.avgPace}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>Avg Speed</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                      {act.avgSpeed} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>km/h</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Kudos & Share */}
                <div className="p-4 px-5 flex justify-between items-center">
                  <button
                    onClick={() => handleToggleKudos(act.id)}
                    style={{
                      background: act.hasKudo ? "rgba(0,232,123,0.18)" : "rgba(255,255,255,0.06)",
                      border: act.hasKudo ? "1px solid rgba(0,232,123,0.4)" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "9999px",
                      padding: "0.45rem 1.1rem",
                      color: act.hasKudo ? "var(--color-green-neon)" : "var(--color-text-secondary)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>👊</span>
                    <span>Gaskeun!</span>
                    {act.kudosCount > 0 && <span style={{ opacity: 0.9 }}>• {act.kudosCount}</span>}
                  </button>

                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Tautan aktivitas disalin!");
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-text-tertiary)",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span>📤</span>
                    <span>Bagikan</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Infinite Scroll Trigger & Bottom States */}
            <div ref={observerTargetRef} className="py-2 text-center">
              {loadingMore && (
                <div style={{ color: "var(--color-green-neon)", fontSize: "0.85rem", padding: "1rem" }}>
                  ⏳ Memuat aktivitas selanjutnya...
                </div>
              )}

              {!loadingMore && hasMore && activities.length > 0 && (
                <button
                  onClick={handleLoadMore}
                  className="btn-glass-secondary"
                  style={{ padding: "0.5rem 1.5rem", fontSize: "0.85rem" }}
                >
                  Muat Lebih Banyak ↓
                </button>
              )}

              {!hasMore && activities.length > 0 && (
                <div style={{ color: "var(--color-text-tertiary)", fontSize: "0.8rem", padding: "1.5rem" }}>
                  🏁 Kamu sudah melihat semua aktivitas rider ini
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

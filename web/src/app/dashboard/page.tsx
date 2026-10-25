"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { API_BASE } from "@/lib/api";
import MapComponent from "@/components/MapComponent";
import { getToken, logout } from "@/lib/auth";

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

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"my_activities" | "feed" | "event">("my_activities");

  // User state
  const [userId, setUserId] = useState<string>("");
  const [profileName, setProfileName] = useState("");
  const [userRole, setUserRole] = useState("USER");
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Event & attendance
  const [event, setEvent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [tikums, setTikums] = useState<any[]>([]);

  // Activities & Pagination / Infinite Scroll
  const [activities, setActivities] = useState<Activity[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = getToken();
    const storedUserId = localStorage.getItem("userId") || "";
    const storedDisplayName = localStorage.getItem("displayName") || "Rider";
    const storedRole = localStorage.getItem("role") || "USER";

    if (!token) {
      router.replace("/login?next=/dashboard");
      return;
    }

    setUserId(storedUserId);
    setProfileName(storedDisplayName);
    setUserRole(storedRole);

    // Load featured event
    fetch(`${API_BASE}/api/events/featured`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.event) setEvent(data.event);
      })
      .catch(() => setMessage("Pastikan backend server berjalan."))
      .finally(() => setLoading(false));

    if (storedUserId) {
      loadStats(storedUserId);
    }
  }, []);

  // Fetch Attendance when event loads
  useEffect(() => {
    if (!event?.id) return;
    const token = getToken();
    const currentUserId = localStorage.getItem("userId") || "";

    fetch(`${API_BASE}/api/me/attendance?event_id=${event.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-User-Id": currentUserId,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.attendances && data.attendances.length > 0) {
          setAttendance(data.attendances[0]);
        }
      })
      .catch(console.error);

    fetch(`${API_BASE}/api/tikums?event_id=${event.id}`)
      .then((res) => res.json())
      .then((data) => setTikums(data.tikums || []))
      .catch(console.error);
  }, [event?.id]);

  // Fetch Activities batch
  const fetchActivitiesBatch = useCallback(
    async (targetOffset: number, isInitial = false) => {
      if (isInitial) {
        setLoadingActivities(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const currentUserId = typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "";
        let url = `${API_BASE}/api/activities?limit=${PAGE_SIZE}&offset=${targetOffset}`;

        if (activeTab === "my_activities" && currentUserId) {
          url += `&user_id=${currentUserId}`;
        }

        const res = await fetch(url, {
          headers: { "X-User-Id": currentUserId },
        });

        if (res.ok) {
          const data = await res.json();
          const newItems: Activity[] = data.activities || [];

          if (isInitial) {
            setActivities(newItems);
          } else {
            setActivities((prev) => {
              // Deduplicate
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
        setLoadingActivities(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  // Reset and load first page on Tab Change
  useEffect(() => {
    if (activeTab === "event") return;
    setOffset(0);
    setHasMore(true);
    fetchActivitiesBatch(0, true);
  }, [activeTab, fetchActivitiesBatch]);

  // Load More Handler
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingActivities || loadingMore) return;
    fetchActivitiesBatch(offset, false);
  }, [hasMore, loadingActivities, loadingMore, offset, fetchActivitiesBatch]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (activeTab === "event") return;
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingActivities && !loadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingActivities, loadingMore, handleLoadMore, activeTab]);

  const loadStats = async (uid: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${uid}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      console.error("Gagal memuat statistik");
    }
  };

  // Toggle Kudos ("👊 Gaskeun!")
  const handleToggleKudos = async (activityId: string) => {
    const token = getToken();
    const currentUserId = localStorage.getItem("userId") || "";
    if (!token) {
      router.push("/login?next=/dashboard");
      return;
    }

    // Optimistic UI update
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
          "X-User-Id": currentUserId,
        },
      });
    } catch (e) {
      console.error("Gagal memberi kudo", e);
    }
  };

  // Delete Activity
  const handleDeleteActivity = async (actId: string) => {
    if (!confirm("Hapus catatan aktivitas ini?")) return;
    const token = getToken();
    const currentUserId = localStorage.getItem("userId") || "";

    try {
      const res = await fetch(`${API_BASE}/api/activities/${actId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-User-Id": currentUserId,
        },
      });
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== actId));
        if (currentUserId) loadStats(currentUserId);
        setMessage("Aktivitas dihapus.");
      }
    } catch {
      setMessage("Gagal menghapus aktivitas.");
    }
  };

  // Event handlers
  const handleAttend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ eventId: event.id, tikumId: null }),
      });

      if (res.ok) {
        const d = await res.json();
        setAttendance(d);
        setMessage("Kamu sudah terdaftar hadir! 🚲");
      } else {
        const d = await res.json();
        setMessage(d.error || "Gagal mendaftar");
      }
    } catch {
      setMessage("Gagal terhubung ke server");
    }
  };

  const handleSelectTikum = async (tikumId: string) => {
    if (!attendance?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/attendance/${attendance.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ tikumId }),
      });

      if (res.ok) {
        setAttendance({ ...attendance, tikumId });
        setMessage("Tikum berhasil dipilih!");
      }
    } catch {
      setMessage("Gagal mengubah Tikum");
    }
  };

  const handleCancelAttendance = async () => {
    if (!attendance?.id) return;
    try {
      await fetch(`${API_BASE}/api/attendance/${attendance.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      setAttendance(null);
      setMessage("Kehadiran dibatalkan.");
    } catch {
      setMessage("Gagal membatalkan");
    }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ displayName: newName }),
      });
      if (res.ok) {
        setProfileName(newName);
        localStorage.setItem("displayName", newName);
        setEditing(false);
        setMessage("Nama tampilan berhasil diubah!");
      }
    } catch {
      setMessage("Gagal mengubah profil");
    }
  };

  const handleLogout = async () => {
    await logout(API_BASE);
    router.push("/");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}j ${remMins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center pt-20">
        <div style={{ color: "var(--color-green-neon)" }}>Memuat Dashboard & Profil...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-20 pb-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 fade-in">
        {/* Toast Message */}
        {message && (
          <div
            style={{
              background: "rgba(0, 232, 123, 0.12)",
              border: "1px solid rgba(0, 232, 123, 0.3)",
              borderRadius: "16px",
              padding: "0.85rem 1.25rem",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backdropFilter: "blur(20px)",
            }}
          >
            <span>{message}</span>
            <button
              onClick={() => setMessage("")}
              style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Profile Header & Identity */}
        <div className="glass-panel p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(0,232,123,0.3), rgba(167,139,250,0.4))",
                  border: "2px solid rgba(0,232,123,0.6)",
                  boxShadow: "0 0 20px rgba(0,232,123,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  flexShrink: 0,
                }}
              >
                {profileName?.[0]?.toUpperCase() || "R"}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{profileName}</h1>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "9999px",
                      background: userRole === "ADMIN" ? "rgba(244,63,94,0.2)" : "rgba(0,232,123,0.15)",
                      color: userRole === "ADMIN" ? "#f43f5e" : "#00e87b",
                      border: userRole === "ADMIN" ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(0,232,123,0.3)",
                    }}
                  >
                    {userRole === "ADMIN" ? "ADMIN" : "PRO RIDER 🚴"}
                  </span>
                </div>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                  Pesepeda Urban Makassar • Member sejak 2026
                </p>

                {editing ? (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="input-glass"
                      style={{ padding: "0.3rem 0.75rem", fontSize: "0.85rem", width: "160px" }}
                      placeholder="Nama baru"
                    />
                    <button onClick={handleUpdateProfile} className="btn-glass-primary" style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}>
                      Simpan
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(true);
                      setNewName(profileName);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-purple-tikum)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      padding: "0",
                      marginTop: "0.25rem",
                    }}
                  >
                    ✏️ Edit Nama
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/live"
                className="btn-glass-primary"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem" }}
              >
                <span>📍</span>
                <span>Mulai di Live Map</span>
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "9999px",
                  padding: "0.6rem 1rem",
                  color: "var(--color-text-tertiary)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>

        {/* 2. Telemetry Cards */}
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
              Kalori Terbakar
            </span>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#f43f5e", marginTop: "0.25rem" }}>
              {stats?.totalCalories || 0}
              <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-secondary)", marginLeft: "0.25rem" }}>kcal</span>
            </div>
          </div>
        </div>

        {/* 3. Liquid Glass Tab Navigation */}
        <div
          style={{
            display: "inline-flex",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "9999px",
            padding: "0.3rem",
            marginBottom: "1.5rem",
            backdropFilter: "blur(20px)",
            gap: "0.25rem",
          }}
        >
          <button
            onClick={() => setActiveTab("my_activities")}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "my_activities" ? "rgba(0,232,123,0.2)" : "transparent",
              color: activeTab === "my_activities" ? "var(--color-green-neon)" : "var(--color-text-secondary)",
              transition: "all 0.2s ease",
            }}
          >
            🚴 Aktivitas Saya
          </button>

          <button
            onClick={() => setActiveTab("feed")}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "feed" ? "rgba(167,139,250,0.2)" : "transparent",
              color: activeTab === "feed" ? "var(--color-purple-tikum)" : "var(--color-text-secondary)",
              transition: "all 0.2s ease",
            }}
          >
            🌍 Feed Komunitas
          </button>

          <button
            onClick={() => setActiveTab("event")}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "event" ? "rgba(255,255,255,0.12)" : "transparent",
              color: activeTab === "event" ? "#ffffff" : "var(--color-text-secondary)",
              transition: "all 0.2s ease",
            }}
          >
            🎫 Event & Tikum
          </button>
        </div>

        {/* 4. Tab Content: Event & Tikum */}
        {activeTab === "event" && (
          <div className="glass-panel-lg p-6 mb-6">
            {event ? (
              <>
                <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-green-neon)", fontWeight: 700, textTransform: "uppercase" }}>
                      Event Mendatang
                    </span>
                    <h3 className="text-xl font-bold mt-1">{event.title}</h3>
                    <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                      {new Date(event.startAt).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <Link href="/live" className="btn-glass-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                    📍 Buka Live Map
                  </Link>
                </div>

                {!attendance || attendance.status === "CANCELLED" ? (
                  <button onClick={handleAttend} className="btn-glass-primary mt-2">
                    🚲 I&apos;M ATTENDING
                  </button>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                      <span
                        style={{
                          padding: "0.3rem 0.8rem",
                          borderRadius: "9999px",
                          background: "rgba(0,232,123,0.15)",
                          border: "1px solid rgba(0,232,123,0.3)",
                          color: "var(--color-green-neon)",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}
                      >
                        Status: {attendance.status}
                      </span>
                    </div>

                    {/* Tikum selection */}
                    {tikums.length > 0 && (
                      <div className="mb-4">
                        <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                          Pilih Titik Kumpul (Tikum) Wilayahmu:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {tikums.map((t: any) => (
                            <button
                              key={t.id}
                              onClick={() => handleSelectTikum(t.id)}
                              style={{
                                padding: "0.5rem 1rem",
                                borderRadius: "9999px",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                border:
                                  attendance.tikumId === t.id
                                    ? "1px solid rgba(167,139,250,0.6)"
                                    : "1px solid rgba(255,255,255,0.1)",
                                background:
                                  attendance.tikumId === t.id
                                    ? "rgba(167,139,250,0.2)"
                                    : "rgba(255,255,255,0.04)",
                                color:
                                  attendance.tikumId === t.id
                                    ? "var(--color-purple-tikum)"
                                    : "var(--color-text-secondary)",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                            >
                              {t.name} ({t.attendeeCount ?? 0} rider)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleCancelAttendance}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-red-finish)",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        opacity: 0.75,
                      }}
                    >
                      Batalkan Kehadiran
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "var(--color-text-secondary)" }}>Tidak ada event aktif saat ini.</p>
            )}
          </div>
        )}

        {/* 5. Activities Feed Cards with Infinite Scroll */}
        {(activeTab === "my_activities" || activeTab === "feed") && (
          <div className="space-y-6">
            {loadingActivities ? (
              <div className="glass-panel p-8 text-center text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                Memuat riwayat perjalanan...
              </div>
            ) : activities.length === 0 ? (
              <div className="glass-panel p-10 text-center">
                <span style={{ fontSize: "2.5rem" }}>🚴</span>
                <h3 className="text-lg font-bold mt-2">Belum ada aktivitas tercatat</h3>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", marginTop: "0.5rem", maxWidth: "360px", marginInline: "auto" }}>
                  {activeTab === "my_activities"
                    ? "Mulai gowes di Live Map untuk merekam perjalananmu secara realtime!"
                    : "Belum ada rider yang memposting perjalanan."}
                </p>
                {activeTab === "my_activities" && (
                  <Link
                    href="/live"
                    className="btn-glass-primary mt-4 inline-block"
                    style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem" }}
                  >
                    📍 Buka Live Map & Mulai Gowes
                  </Link>
                )}
              </div>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="glass-panel-lg overflow-hidden transition-all duration-300">
                  {/* Card Header: User Info */}
                  <div className="p-5 pb-3 flex justify-between items-start">
                    <Link
                      href={`/profile/${act.userId}`}
                      className="flex items-center gap-3 transition-opacity hover:opacity-85"
                      style={{ textDecoration: "none", color: "inherit" }}
                      title={`Lihat profil ${act.userName}`}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(0,232,123,0.3))",
                          border: "1.5px solid rgba(255,255,255,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "1.1rem",
                        }}
                      >
                        {act.userName?.[0]?.toUpperCase() || "R"}
                      </div>
                      <div>
                        <div className="font-semibold text-base flex items-center gap-1.5">
                          <span>{act.userName}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-green-neon)" }}>↗</span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
                          {new Date(act.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </Link>

                    {act.userId === userId && (
                      <button
                        onClick={() => handleDeleteActivity(act.id)}
                        title="Hapus aktivitas"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-text-tertiary)",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          opacity: 0.6,
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {/* Title & Notes */}
                  <div className="px-5 pb-3">
                    <h2 className="text-lg font-bold text-white tracking-tight">{act.title}</h2>
                    {act.notes && (
                      <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "0.35rem", lineHeight: 1.5 }}>
                        {act.notes}
                      </p>
                    )}
                  </div>

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
                          setMessage("Tautan berhasil disalin!");
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
              ))
            )}

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
                  🏁 Kamu sudah melihat semua aktivitas
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { API_BASE } from "@/lib/api";
import MapComponent from "@/components/MapComponent";
import { getToken, logout } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [tikums, setTikums] = useState<any[]>([]);
  const [profileName, setProfileName] = useState("");
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login?next=/dashboard");
      return;
    }

    fetch(`${API_BASE}/api/events/featured`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat event");
        return res.json();
      })
      .then((data) => setEvent(data.event || null))
      .catch(() => setMessage("Gagal memuat data event. Pastikan server API aktif."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!event?.id) return;

    // Get attendance status
    fetch(`${API_BASE}/api/me/attendance?event_id=${event.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.attendances && data.attendances.length > 0) {
          setAttendance(data.attendances[0]);
        }
      });

    // Get tikums
    fetch(`${API_BASE}/api/tikums?event_id=${event.id}`)
      .then((res) => res.json())
      .then((data) => setTikums(data.tikums || []));
  }, [event?.id]);

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

  const handleCancel = async () => {
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
      await fetch(`${API_BASE}/api/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-User-Id": localStorage.getItem("userId") || "",
        },
        body: JSON.stringify({ displayName: newName }),
      });
      setProfileName(newName);
      setEditing(false);
      setMessage("Nama tampilan berhasil diubah!");
    } catch {
      setMessage("Gagal mengubah profil");
    }
  };

  const handleLogout = async () => {
    await logout(API_BASE);
    router.push("/");
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      ATTENDING: "🟢 Hadir",
      ON_THE_WAY: "🔵 On The Way",
      AT_TIKUM: "🟡 Di Tikum",
      FINISHED: "🟣 Finish",
      CANCELLED: "⚫ Dibatalkan",
    };
    return map[status] || status;
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center pt-20">Memuat dashboard...</main>;
  }

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 fade-in">
        <h1 className="heading-display text-3xl mb-2">Dashboard</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "2rem" }}>Kelola kehadiran dan trackingmu.</p>

        {/* Message */}
        {message && (
          <div style={{ background: "rgba(0,232,123,0.1)", border: "1px solid rgba(0,232,123,0.2)", borderRadius: "12px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.9rem" }}
               onClick={() => setMessage("")}
               role="button" tabIndex={0}>
            {message}
          </div>
        )}

        {/* Profile Section */}
        <div className="glass-panel p-5 mb-6">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Nama Tampilan</h3>
              {editing ? (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-glass"
                    placeholder="Nama baru"
                  />
                  <button onClick={handleUpdateProfile} className="btn-glass-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>Simpan</button>
                  <button onClick={() => setEditing(false)} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", background: "transparent", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>Batal</button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: "1.1rem", fontWeight: 500, marginTop: "0.25rem" }}>{profileName}</p>
                  <button onClick={() => { setEditing(true); setNewName(profileName); }} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "0.85rem", padding: "0" }}>Ubah</button>
                </>
              )}
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: "0.85rem" }}>Keluar</button>
          </div>
        </div>

        {/* Event Attendance */}
        <div className="glass-panel-lg p-6 mb-6">
          {event ? (
            <>
              <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{event.title}</h3>
              <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                {new Date(event.startAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>

              {!attendance || attendance.status === "CANCELLED" ? (
                <button onClick={handleAttend} className="btn-glass-primary">
                  🚲 I&apos;M ATTENDING
                </button>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600 }}>{getStatusText(attendance.status)}</span>
                    {attendance.status !== "ON_THE_WAY" && (
                      <Link href="/live" className="btn-glass-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                        📍 Buka Live Map
                      </Link>
                    )}
                  </div>

                  {/* Tikum selection */}
                  {(attendance.status === "ATTENDING" || attendance.status === "AT_TIKUM") && tikums.length > 0 && (
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>Pilih Tikum:</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {tikums.map((t: any) => (
                          <button key={t.id} onClick={() => handleSelectTikum(t.id)} style={{
                            padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: 500,
                            border: attendance.tikumId === t.id ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.1)",
                            background: attendance.tikumId === t.id ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                            color: attendance.tikumId === t.id ? "var(--color-purple-tikum)" : "var(--color-text-secondary)",
                            cursor: "pointer", transition: "all 0.2s ease",
                          }}>
                            {t.name} ({t.attendeeCount ?? 0})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cancel button */}
                  <button onClick={handleCancel} style={{ background: "none", border: "none", color: "var(--color-red-finish)", cursor: "pointer", fontSize: "0.85rem", marginTop: "1rem", opacity: 0.7 }}>
                    Batalkan Kehadiran
                  </button>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--color-text-secondary)" }}>Tidak ada event aktif.</p>
          )}
        </div>
      </div>
    </main>
  );
}

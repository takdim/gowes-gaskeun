"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MapComponent from "@/components/MapComponent";

import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function TikumPage() {
  const [tikums, setTikums] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [eventReady, setEventReady] = useState(false);
  const [myAttendance, setMyAttendance] = useState<any>(null);
  const [loadingTikumId, setLoadingTikumId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/events/featured`);
      const data = await res.json();
      if (data.event?.id) {
        setEventId(data.event.id);
        const tRes = await fetch(`${API_BASE}/api/tikums?event_id=${data.event.id}`);
        const tData = await tRes.json();
        setTikums(tData.tikums || []);

        const token = getToken();
        const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
        setIsLoggedIn(Boolean(token));

        if (token && userId) {
          const aRes = await fetch(`${API_BASE}/api/me/attendance?event_id=${data.event.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-User-Id": userId,
            },
          });
          if (aRes.ok) {
            const aData = await aRes.json();
            if (aData.attendances && aData.attendances.length > 0) {
              setMyAttendance(aData.attendances[0]);
            } else {
              setMyAttendance(null);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEventReady(true);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectTikum = async (tikumId: string) => {
    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) {
      window.location.href = `/login?next=/tikum`;
      return;
    }

    if (!eventId) return;

    setLoadingTikumId(tikumId);
    setMessage("");

    try {
      if (myAttendance?.id) {
        // Update Tikum via PATCH
        const res = await fetch(`${API_BASE}/api/attendance/${myAttendance.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-User-Id": userId,
          },
          body: JSON.stringify({ tikumId }),
        });
        if (res.ok) {
          setMessage("Berhasil memilih titik kumpul! 🚲");
          await loadData();
        } else {
          const err = await res.json().catch(() => ({}));
          setMessage(err.error || "Gagal mengubah titik kumpul");
        }
      } else {
        // Create Attendance via POST
        const res = await fetch(`${API_BASE}/api/attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-User-Id": userId,
          },
          body: JSON.stringify({ eventId, tikumId }),
        });
        if (res.ok) {
          setMessage("Berhasil mendaftar dan bergabung ke titik kumpul! 🚲");
          await loadData();
        } else {
          const err = await res.json().catch(() => ({}));
          setMessage(err.error || "Gagal mendaftar ke titik kumpul");
        }
      }
    } catch {
      setMessage("Terjadi kesalahan koneksi");
    } finally {
      setLoadingTikumId(null);
    }
  };

  const handleLeaveTikum = async () => {
    if (!myAttendance?.id) return;
    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) return;

    setLoadingTikumId("leave");
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/attendance/${myAttendance.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Id": userId,
        },
        body: JSON.stringify({ tikumId: null }),
      });
      if (res.ok) {
        setMessage("Tikum berhasil dibatalkan.");
        await loadData();
      }
    } catch {
      setMessage("Gagal membatalkan Tikum");
    } finally {
      setLoadingTikumId(null);
    }
  };

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 className="heading-display text-3xl md:text-4xl mb-2">Titik Kumpul (Tikum)</h1>
            <p style={{ color: "var(--color-text-secondary)" }}>Pilih titik kumpul terdekat dari lokasimu untuk gowes bareng ke lokasi Start.</p>
          </div>
          {isLoggedIn ? (
            myAttendance?.tikumName ? (
              <div className="glass-panel" style={{ padding: "0.5rem 1rem", border: "1px solid rgba(0,232,123,0.3)" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-tertiary)" }}>Tikum Pilihanmu:</span>
                <p style={{ fontWeight: 700, color: "var(--color-green-neon)" }}>⭐ {myAttendance.tikumName}</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "0.5rem 1rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-tertiary)" }}>Status:</span>
                <p style={{ fontSize: "0.85rem", color: "var(--color-purple-tikum)" }}>Belum memilih Tikum</p>
              </div>
            )
          ) : (
            <Link href="/login?next=/tikum" className="btn-glass-secondary" style={{ fontSize: "0.85rem" }}>
              Masuk untuk Bergabung
            </Link>
          )}
        </div>

        {message && (
          <div className="glass-panel p-4 mb-6" style={{ background: "rgba(0,232,123,0.1)", border: "1px solid rgba(0,232,123,0.3)", color: "var(--color-green-neon)" }}>
            {message}
          </div>
        )}

        {eventReady && tikums.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p style={{ color: "var(--color-text-secondary)" }}>Belum ada Tikum yang ditetapkan untuk event ini.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 mb-8">
              {tikums.map((t: any) => {
                const isSelected = myAttendance?.tikumId === t.id;
                const isLoading = loadingTikumId === t.id;
                const count = t.attendeeCount ?? t.attendee_count ?? 0;

                return (
                  <div
                    key={t.id}
                    className="glass-panel p-5"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                      borderColor: isSelected ? "rgba(0,232,123,0.5)" : undefined,
                      boxShadow: isSelected ? "0 0 20px rgba(0,232,123,0.15)" : undefined,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                        <h3 style={{ fontWeight: 700, color: "var(--color-purple-tikum)", fontSize: "1.1rem" }}>{t.name}</h3>
                        {isSelected && (
                          <span className="badge-live" style={{ fontSize: "0.75rem", padding: "0.15rem 0.6rem" }}>
                            ⭐ Pilihanmu
                          </span>
                        )}
                      </div>
                      {t.meetTime && (
                        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>
                          ⏰ Jam kumpul: <strong>{t.meetTime}</strong>
                        </p>
                      )}
                      {t.contact && (
                        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>
                          👤 PIC / Kontak: {t.contact}
                        </p>
                      )}
                      <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
                        🚴 <strong style={{ color: "var(--color-green-neon)" }}>{count}</strong> rider terdaftar
                        {t.quota ? ` (Kuota: ${t.quota})` : ""}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a
                        href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
                        target="_blank"
                        rel="noopener"
                        className="btn-glass-secondary"
                        style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                      >
                        📍 Peta
                      </a>

                      {isSelected ? (
                        <button
                          onClick={handleLeaveTikum}
                          disabled={loadingTikumId === "leave"}
                          style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "9999px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            background: "rgba(244,63,94,0.15)",
                            border: "1px solid rgba(244,63,94,0.3)",
                            color: "#f43f5e",
                            cursor: "pointer",
                          }}
                        >
                          {loadingTikumId === "leave" ? "Memproses..." : "Batalkan Pilihan"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSelectTikum(t.id)}
                          disabled={isLoading}
                          className="btn-glass-primary"
                          style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
                        >
                          {isLoading
                            ? "Memproses..."
                            : myAttendance?.tikumId
                            ? "Pindah ke Tikum Ini"
                            : "🚲 Gabung Tikum Ini"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {tikums.length > 0 && (
              <div>
                <h3 style={{ fontWeight: 600, marginBottom: "0.75rem", fontSize: "1rem" }}>Peta Sebaran Titik Kumpul:</h3>
                <div className="glass-panel overflow-hidden" style={{ minHeight: "350px", borderRadius: "24px" }}>
                  <MapComponent
                    markers={tikums.map((t: any) => ({
                      lat: t.lat,
                      lng: t.lng,
                      label: `${t.name} (${t.attendeeCount ?? t.attendee_count ?? 0})`,
                      color: myAttendance?.tikumId === t.id ? "#00e87b" : "#a78bfa",
                    })) as any}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

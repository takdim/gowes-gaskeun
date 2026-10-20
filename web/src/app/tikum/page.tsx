"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import io from "socket.io-client";
import Navbar from "@/components/Navbar";
import MapComponent from "@/components/MapComponent";

import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface TikumMessage {
  id: string;
  tikumId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

export default function TikumPage() {
  const [tikums, setTikums] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [eventReady, setEventReady] = useState(false);
  const [joinedTikumIds, setJoinedTikumIds] = useState<string[]>([]);
  const [loadingTikumId, setLoadingTikumId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Chat State
  const [activeChatTikum, setActiveChatTikum] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<TikumMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const socketRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll chat to bottom
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Load Tikums and User Memberships
  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/events/featured`);
      const data = await res.json();
      if (data.event?.id) {
        const currentEventId = data.event.id;
        setEventId(currentEventId);

        const tRes = await fetch(`${API_BASE}/api/tikums?event_id=${currentEventId}`);
        const tData = await tRes.json();
        setTikums(tData.tikums || []);

        const token = getToken();
        const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
        setIsLoggedIn(Boolean(token));

        if (token && userId) {
          const mRes = await fetch(`${API_BASE}/api/me/tikums?event_id=${currentEventId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-User-Id": userId,
            },
          });
          if (mRes.ok) {
            const mData = await mRes.json();
            setJoinedTikumIds(mData.joinedTikumIds || []);
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

  // Setup WebSocket connection for chat
  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("new-tikum-message", (msg: TikumMessage) => {
      setActiveChatTikum((currTikum: any) => {
        if (currTikum && currTikum.id === msg.tikumId) {
          setChatMessages((prev) => {
            // Avoid duplicate message IDs
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        return currTikum;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Join a Tikum (Max 2 rule)
  const handleJoinTikum = async (tikumId: string) => {
    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) {
      window.location.href = `/login?next=/tikum`;
      return;
    }

    setLoadingTikumId(tikumId);
    setMessage("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/tikums/${tikumId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Id": userId,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "Berhasil bergabung ke Tikum!");
        await loadData();
      } else {
        setErrorMsg(data.error || "Gagal bergabung ke Tikum");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan koneksi");
    } finally {
      setLoadingTikumId(null);
    }
  };

  // Leave a Tikum
  const handleLeaveTikum = async (tikumId: string) => {
    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) return;

    if (!window.confirm("Keluar dari Tikum ini? Kamu tidak akan bisa lagi membaca atau mengirim chat di Tikum ini.")) {
      return;
    }

    setLoadingTikumId(tikumId);
    setMessage("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/tikums/${tikumId}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Id": userId,
        },
      });

      if (res.ok) {
        setMessage("Berhasil keluar dari Tikum.");
        if (activeChatTikum?.id === tikumId) {
          closeChat();
        }
        await loadData();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Gagal keluar dari Tikum");
      }
    } catch {
      setErrorMsg("Gagal membatalkan Tikum");
    } finally {
      setLoadingTikumId(null);
    }
  };

  // Open Chat Drawer for a Tikum
  const openChat = async (tikum: any) => {
    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) {
      window.location.href = `/login?next=/tikum`;
      return;
    }

    setActiveChatTikum(tikum);
    setLoadingChat(true);
    setChatMessages([]);

    // Join room via socket
    if (socketRef.current) {
      socketRef.current.emit("join-tikum-chat", { tikumId: tikum.id });
    }

    try {
      const res = await fetch(`${API_BASE}/api/tikums/${tikum.id}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-User-Id": userId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Gagal memuat pesan chat");
      }
    } catch {
      setErrorMsg("Gagal menghubungi server chat");
    } finally {
      setLoadingChat(false);
    }
  };

  // Close Chat Drawer
  const closeChat = () => {
    if (activeChatTikum && socketRef.current) {
      socketRef.current.emit("leave-tikum-chat", { tikumId: activeChatTikum.id });
    }
    setActiveChatTikum(null);
    setChatMessages([]);
    setInputMessage("");
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChatTikum || sendingMessage) return;

    const token = getToken();
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!token || !userId) return;

    const text = inputMessage.trim();
    setInputMessage("");
    setSendingMessage(true);

    try {
      const res = await fetch(`${API_BASE}/api/tikums/${activeChatTikum.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Id": userId,
        },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Gagal mengirim pesan");
      }
    } catch {
      setErrorMsg("Gagal mengirim pesan");
    } finally {
      setSendingMessage(false);
    }
  };

  const currentUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  return (
    <main className="min-h-screen pt-20 pb-20">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 fade-in">
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 className="heading-display text-3xl md:text-4xl mb-2">Titik Kumpul (Tikum)</h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem" }}>
              Pilih titik kumpul terdekat dari lokasimu untuk gowes bareng ke lokasi Start.
            </p>
            <div style={{ marginTop: "0.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-tertiary)" }}>
              <span>ℹ️ Setiap rider dapat bergabung maksimal <strong>2 Tikum</strong> untuk koordinasi chat.</span>
            </div>
          </div>

          {isLoggedIn ? (
            <div className="glass-panel" style={{ padding: "0.6rem 1.25rem", border: "1px solid rgba(0,232,123,0.3)" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status Keanggotaan</span>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: joinedTikumIds.length > 0 ? "var(--color-green-neon)" : "var(--color-purple-tikum)", marginTop: "0.1rem" }}>
                {joinedTikumIds.length} / 2 Tikum Tergabung
              </p>
            </div>
          ) : (
            <Link href="/login?next=/tikum" className="btn-glass-secondary" style={{ fontSize: "0.85rem" }}>
              Masuk untuk Bergabung & Chat
            </Link>
          )}
        </div>

        {/* Feedback alerts */}
        {message && (
          <div className="glass-panel p-4 mb-4" style={{ background: "rgba(0,232,123,0.1)", border: "1px solid rgba(0,232,123,0.3)", color: "var(--color-green-neon)" }}>
            {message}
          </div>
        )}
        {errorMsg && (
          <div className="glass-panel p-4 mb-4" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#f43f5e" }}>
            {errorMsg}
          </div>
        )}

        {/* Tikum Cards */}
        {eventReady && tikums.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p style={{ color: "var(--color-text-secondary)" }}>Belum ada Tikum yang ditetapkan untuk event ini.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 mb-8">
              {tikums.map((t: any) => {
                const isJoined = joinedTikumIds.includes(t.id);
                const isLoading = loadingTikumId === t.id;
                const count = t.attendeeCount ?? t.attendee_count ?? 0;
                const canJoinMore = joinedTikumIds.length < 2;

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
                      borderColor: isJoined ? "rgba(0,232,123,0.5)" : undefined,
                      boxShadow: isJoined ? "0 0 24px rgba(0,232,123,0.15)" : undefined,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "220px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                        <h3 style={{ fontWeight: 700, color: "var(--color-purple-tikum)", fontSize: "1.15rem" }}>{t.name}</h3>
                        {isJoined && (
                          <span className="badge-live" style={{ fontSize: "0.75rem", padding: "0.15rem 0.6rem" }}>
                            ⭐ Tergabung
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
                          👤 Kontak: {t.contact}
                        </p>
                      )}
                      <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
                        🚴 <strong style={{ color: "var(--color-green-neon)" }}>{count}</strong> rider terdaftar
                        {t.quota ? ` (Kuota: ${t.quota})` : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a
                        href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
                        target="_blank"
                        rel="noopener"
                        className="btn-glass-secondary"
                        style={{ padding: "0.5rem 0.9rem", fontSize: "0.85rem" }}
                      >
                        📍 Peta
                      </a>

                      {isJoined ? (
                        <>
                          <button
                            onClick={() => openChat(t)}
                            className="btn-glass-primary"
                            style={{
                              padding: "0.5rem 1.1rem",
                              fontSize: "0.85rem",
                              background: "linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(124,58,237,0.2) 100%)",
                              border: "1px solid rgba(167,139,250,0.4)",
                              color: "#fff",
                            }}
                          >
                            💬 Chat Tikum
                          </button>
                          <button
                            onClick={() => handleLeaveTikum(t.id)}
                            disabled={isLoading}
                            style={{
                              padding: "0.5rem 0.9rem",
                              borderRadius: "9999px",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              background: "rgba(244,63,94,0.15)",
                              border: "1px solid rgba(244,63,94,0.3)",
                              color: "#f43f5e",
                              cursor: "pointer",
                            }}
                          >
                            {isLoading ? "..." : "Keluar"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleJoinTikum(t.id)}
                          disabled={isLoading || (!canJoinMore && !isJoined)}
                          className="btn-glass-primary"
                          style={{
                            padding: "0.5rem 1.25rem",
                            fontSize: "0.85rem",
                            opacity: !canJoinMore ? 0.6 : 1,
                            cursor: !canJoinMore ? "not-allowed" : "pointer",
                          }}
                        >
                          {isLoading
                            ? "Memproses..."
                            : !canJoinMore
                            ? "Maks 2 Tikum Penuh"
                            : "🚲 Gabung Tikum"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map Overview */}
            {tikums.length > 0 && (
              <div>
                <h3 style={{ fontWeight: 600, marginBottom: "0.75rem", fontSize: "1rem" }}>Peta Sebaran Titik Kumpul:</h3>
                <div className="glass-panel overflow-hidden" style={{ minHeight: "350px", borderRadius: "24px" }}>
                  <MapComponent
                    markers={tikums.map((t: any) => ({
                      lat: t.lat,
                      lng: t.lng,
                      label: `${t.name} (${t.attendeeCount ?? t.attendee_count ?? 0})`,
                      color: joinedTikumIds.includes(t.id) ? "#00e87b" : "#a78bfa",
                    })) as any}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Slide-Over / Modal Chat Tikum Realtime ── */}
      {activeChatTikum && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeChat();
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "520px",
              height: "85vh",
              maxHeight: "700px",
              display: "flex",
              flexDirection: "column",
              borderRadius: "28px",
              border: "1px solid rgba(167,139,250,0.3)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
              background: "rgba(18,18,26,0.92)",
            }}
          >
            {/* Chat Header */}
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--color-purple-tikum)" }}>
                    {activeChatTikum.name}
                  </h3>
                  <span className="badge-live" style={{ fontSize: "0.7rem", padding: "0.1rem 0.5rem" }}>
                    Live Chat
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginTop: "0.2rem" }}>
                  🔒 Khusus anggota aktif Tikum • Hanya pesan setelah kamu bergabung
                </p>
              </div>
              <button
                onClick={closeChat}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Chat Messages List */}
            <div
              ref={chatScrollRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {loadingChat ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-tertiary)" }}>
                  Memuat obrolan...
                </div>
              ) : chatMessages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-tertiary)" }}>
                  <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</p>
                  <p style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>Belum ada pesan baru</p>
                  <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                    Sebagai anggota baru, pesan yang dikirim sebelum kamu bergabung tidak ditampilkan. Mulai obrolan dengan menyapa teman-teman Tikum!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.userId === currentUserId;
                  const time = new Date(msg.createdAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMe ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        alignSelf: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isMe && (
                        <span style={{ fontSize: "0.75rem", color: "var(--color-purple-tikum)", fontWeight: 600, marginBottom: "0.2rem", paddingLeft: "0.5rem" }}>
                          {msg.displayName}
                        </span>
                      )}
                      <div
                        style={{
                          padding: "0.6rem 1rem",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isMe
                            ? "linear-gradient(135deg, rgba(0,232,123,0.3) 0%, rgba(0,232,123,0.15) 100%)"
                            : "rgba(255,255,255,0.08)",
                          border: isMe
                            ? "1px solid rgba(0,232,123,0.4)"
                            : "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                          fontSize: "0.9rem",
                          wordBreak: "break-word",
                          lineHeight: 1.4,
                        }}
                      >
                        {msg.content}
                      </div>
                      <span style={{ fontSize: "0.65rem", color: "var(--color-text-tertiary)", marginTop: "0.2rem", padding: "0 0.4rem" }}>
                        {time}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: "0.75rem 1rem",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder={`Tulis pesan ke ${activeChatTikum.name}...`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="input-glass"
                style={{ flex: 1, padding: "0.65rem 1rem", fontSize: "0.9rem" }}
                disabled={sendingMessage}
                autoFocus
              />
              <button
                type="submit"
                disabled={sendingMessage || !inputMessage.trim()}
                className="btn-glass-primary"
                style={{
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.85rem",
                  opacity: !inputMessage.trim() ? 0.5 : 1,
                }}
              >
                {sendingMessage ? "..." : "Kirim ↵"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

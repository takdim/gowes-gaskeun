"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { API_BASE } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";

const authHeaders = () => ({
  "Content-Type": "application/json",
  ...getAuthHeaders(),
});

type Tab = "overview" | "event" | "locations" | "tikums" | "attendees" | "users";

export default function AdminPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", tagline: "", description: "", startAt: "", endAt: "", status: "PUBLISHED", is_featured: false });
  const [locationForm, setLocationForm] = useState({ type: "START", name: "", time: "", lat: "", lng: "" });
  const [tikusmForm, setTikusmForm] = useState({ name: "", meet_time: "", lat: "", lng: "", quota: "", contact: "", coordinatorId: "" });
  const [userForm, setUserForm] = useState({ displayName: "", email: "", password: "", role: "TIKUM_COORDINATOR", tikumId: "" });
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalAttendances: 0, liveRiders: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [tikums, setTikums] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [editingTikumId, setEditingTikumId] = useState<string | null>(null);
  const [tikumEdit, setTikumEdit] = useState({ name: "", meet_time: "", quota: "", contact: "", lat: "", lng: "" });
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationEdit, setLocationEdit] = useState({ type: "START", name: "", time: "", lat: "", lng: "" });

  // Auth + role check — run once on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("role");
    if (!token) { router.push("/login?next=/admin"); return; }
    if (userRole !== "ADMIN" && userRole !== "TIKUM_COORDINATOR") { router.push("/dashboard"); return; }
    setRole(userRole);
    setUserId(localStorage.getItem("userId") || "");
    setLoading(false);
  }, []);

  const loadUsers = useCallback(() => {
    fetch(`${API_BASE}/api/admin/users`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  const loadEventData = useCallback((eventId: string) => {
    if (!eventId) return;
    fetch(`${API_BASE}/api/tikums?event_id=${eventId}`)
      .then((res) => res.json())
      .then((d) => setTikums(d.tikums || []))
      .catch(() => {});
    if (localStorage.getItem("role") === "ADMIN") {
      fetch(`${API_BASE}/api/admin/events/${eventId}/locations`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((d) => setLocations(d.locations || []))
        .catch(() => {});
    }
    fetch(`${API_BASE}/api/admin/events/${eventId}/attendances`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((d) => setAttendances(d.attendances || []))
      .catch(() => {});
  }, []);

  const loadEvents = useCallback(() => {
    return fetch(`${API_BASE}/api/admin/events`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        return data.events || [];
      })
      .catch(() => []);
  }, []);

  useEffect(() => {
    if (loading) return;
    loadEvents().then((list: any[]) => {
      if (!selectedEventId && list[0]?.id) setSelectedEventId(list[0].id);
    });
    if (localStorage.getItem("role") === "ADMIN") loadUsers();
  }, [loading]);

  useEffect(() => {
    if (!selectedEventId || loading) return;
    fetch(`${API_BASE}/api/stats?event_id=${selectedEventId}`)
      .then((r) => r.json())
      .then((d) => setStats({ totalAttendances: d.totalAttending || 0, liveRiders: d.onTheWay || 0 }))
      .catch(() => {});
    loadEventData(selectedEventId);
  }, [selectedEventId, loading]);

  const handleSaveEvent = async () => {
    try {
      if (editingEvent) {
        await fetch(`${API_BASE}/api/admin/events/${editingEvent.id}`, {
          method: "PUT", headers: authHeaders(),
          body: JSON.stringify(formData),
        });
      } else {
        const res = await fetch(`${API_BASE}/api/admin/events`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify(formData),
        });
        if (!res.ok) { setMessage("Gagal menyimpan"); return; }
      }
      await loadEvents();
      setShowForm(false); setEditingEvent(null);
      setMessage(editingEvent ? "Event diperbarui!" : "Event baru dibuat!");
    } catch { setMessage("Gagal menyimpan"); }
  };

  const handleAddLocation = async () => {
    if (!selectedEventId) { setMessage("Pilih event dulu"); return; }
    try {
      const res = await fetch(`${API_BASE}/api/admin/events/${selectedEventId}/locations`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ ...locationForm, lat: parseFloat(locationForm.lat), lng: parseFloat(locationForm.lng) }),
      });
      if (!res.ok) { setMessage("Gagal menambahkan lokasi"); return; }
      setLocationForm({ type: "START", name: "", time: "", lat: "", lng: "" });
      loadEventData(selectedEventId);
      setMessage("Lokasi ditambahkan!");
    } catch { setMessage("Gagal menambahkan lokasi"); }
  };

  const startEditLocation = (l: any) => {
    setEditingLocationId(l.id);
    setLocationEdit({
      type: l.type || "START",
      name: l.name || "",
      time: l.time || "",
      lat: l.lat != null ? String(l.lat) : "",
      lng: l.lng != null ? String(l.lng) : "",
    });
  };

  const handleUpdateLocation = async (locationId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/locations/${locationId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          type: locationEdit.type,
          name: locationEdit.name,
          time: locationEdit.time,
          lat: parseFloat(locationEdit.lat),
          lng: parseFloat(locationEdit.lng),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "Gagal memperbarui lokasi");
        return;
      }
      setEditingLocationId(null);
      loadEventData(selectedEventId);
      setMessage("Lokasi diperbarui!");
    } catch {
      setMessage("Gagal memperbarui lokasi");
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!window.confirm("Hapus lokasi ini?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/locations/${locationId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "Gagal menghapus lokasi");
        return;
      }
      loadEventData(selectedEventId);
      setMessage("Lokasi dihapus!");
    } catch {
      setMessage("Gagal menghapus lokasi");
    }
  };

  const handleAddTikum = async () => {
    if (!selectedEventId) { setMessage("Pilih event dulu"); return; }
    try {
      const body: any = {
        name: tikusmForm.name,
        meet_time: tikusmForm.meet_time,
        contact: tikusmForm.contact,
        lat: parseFloat(tikusmForm.lat),
        lng: parseFloat(tikusmForm.lng),
        quota: tikusmForm.quota ? parseInt(tikusmForm.quota) : null,
      };
      // Hanya admin yang boleh menetapkan koordinator; koordinator otomatis jadi koordinator Tikum baru.
      if (isAdmin) body.coordinator_user_id = tikusmForm.coordinatorId || null;

      const res = await fetch(`${API_BASE}/api/admin/events/${selectedEventId}/tikums`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "Gagal menambahkan Tikum");
        return;
      }
      setTikusmForm({ name: "", meet_time: "", lat: "", lng: "", quota: "", contact: "", coordinatorId: "" });
      loadEventData(selectedEventId);
      setMessage("Tikum ditambahkan!");
    } catch { setMessage("Gagal menambahkan Tikum"); }
  };

  const startEditTikum = (tk: any) => {
    setEditingTikumId(tk.id);
    setTikumEdit({
      name: tk.name || "",
      meet_time: tk.meetTime || "",
      quota: tk.quota != null ? String(tk.quota) : "",
      contact: tk.contact || "",
      lat: tk.lat != null ? String(tk.lat) : "",
      lng: tk.lng != null ? String(tk.lng) : "",
    });
  };

  const handleUpdateTikum = async (tikumId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/tikums/${tikumId}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({
          name: tikumEdit.name,
          meet_time: tikumEdit.meet_time,
          contact: tikumEdit.contact,
          quota: tikumEdit.quota ? parseInt(tikumEdit.quota) : null,
          lat: parseFloat(tikumEdit.lat),
          lng: parseFloat(tikumEdit.lng),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "Gagal memperbarui Tikum");
        return;
      }
      setEditingTikumId(null);
      loadEventData(selectedEventId);
      setMessage("Tikum diperbarui!");
    } catch { setMessage("Gagal memperbarui Tikum"); }
  };

  const handleDeleteTikum = async (tikumId: string) => {
    if (!window.confirm("Hapus Tikum ini?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/tikums/${tikumId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "Gagal menghapus Tikum");
        return;
      }
      loadEventData(selectedEventId);
      setMessage("Tikum dihapus!");
    } catch { setMessage("Gagal menghapus Tikum"); }
  };

  const handleAssignCoordinator = async (tikumId: string, coordinatorId: string) => {
    try {
      await fetch(`${API_BASE}/api/admin/tikums/${tikumId}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ coordinator_user_id: coordinatorId || null }),
      });
      loadEventData(selectedEventId);
      setMessage("Koordinator diperbarui!");
    } catch { setMessage("Gagal update koordinator"); }
  };

  const handleCreateUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          displayName: userForm.displayName,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          tikumId: userForm.role === "TIKUM_COORDINATOR" ? userForm.tikumId || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Gagal membuat akun"); return; }
      setUserForm({ displayName: "", email: "", password: "", role: "TIKUM_COORDINATOR", tikumId: "" });
      loadUsers();
      loadEventData(selectedEventId);
      setMessage(`Akun ${data.role} dibuat: ${data.email}`);
    } catch { setMessage("Gagal membuat akun"); }
  };

  const publishEvent = async (eventId: string, featured: boolean) => {
    try {
      await fetch(`${API_BASE}/api/admin/events/${eventId}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ is_featured: featured }),
      });
      await loadEvents();
      if (featured) setSelectedEventId(eventId);
      setMessage(featured ? "Ditampilkan di beranda!" : "Dihapus dari beranda.");
    } catch { setMessage("Gagal mengubah status"); }
  };

  if (loading) return <main className="min-h-screen flex items-center justify-center pt-20"><div style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>Memuat...</div></main>;

  const selEvent = events.find((e) => e.id === selectedEventId);
  const coordinators = users.filter((u) => u.role === "TIKUM_COORDINATOR");
  const isAdmin = role === "ADMIN";

  const TABS: [Tab, string][] = [
    ["overview", "📊 Overview"], ["event", "📅 Event"], ["locations", "📍 Lokasi"],
    ["tikums", "🟣 Tikum"], ["attendees", "👥 Peserta"], ["users", "👤 Pengguna"],
  ];
  const visibleTabs = isAdmin ? TABS : TABS.filter(([t]) => t === "overview" || t === "tikums" || t === "attendees");
  const myTikums = isAdmin ? tikums : tikums.filter((t: any) => t.coordinatorId === userId);

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="heading-display text-3xl mb-1">Panel Admin</h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>{isAdmin ? "Kelola event, lokasi, peserta, dan pengguna." : "Kelola Tikum yang Anda koordinasikan."}</p>
          </div>
          <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="input-glass" style={{ maxWidth: "280px" }}>
            <option value="">— Pilih Event —</option>
            {events.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div className="glass-panel p-4 mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
          {[
            { label: "Peserta", value: stats.totalAttendances, color: "var(--color-green-neon)" },
            { label: "Live", value: stats.liveRiders, color: "#a78bfa" },
            { label: "Publish", value: events.filter((e: any) => e.status === "PUBLISHED").length, color: "#f43f5e" },
            { label: "Events", value: events.length, color: "var(--color-text-secondary)" },
          ].map((s: any) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, fontFamily: "var(--font-heading)", color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {message && (
          <div style={{ background: "rgba(0,232,123,0.1)", border: "1px solid rgba(0,232,123,0.2)", borderRadius: "12px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.9rem", cursor: "pointer" }} onClick={() => setMessage("")}>{message}</div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
          {visibleTabs.map(([t, l]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "0.75rem 1.25rem", fontWeight: 500, fontSize: "0.85rem", whiteSpace: "nowrap",
              borderTop: "none", borderLeft: "none", borderRight: "none",
              borderBottom: activeTab === t ? "2px solid var(--color-green-neon)" : "2px solid transparent",
              color: activeTab === t ? "var(--color-green-neon)" : "var(--color-text-secondary)",
              background: "none", cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === "overview" && selEvent && (
          <div className="glass-panel-lg p-6">
            <h3 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.5rem" }}>{selEvent.title}</h3>
            {selEvent.tagline && <p style={{ color: "var(--color-green-neon)", marginBottom: "0.5rem" }}>{selEvent.tagline}</p>}
            <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>Mulai: {new Date(selEvent.startAt).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} · {selEvent.status}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
              {isAdmin && (
                <>
                  <button onClick={() => { setEditingEvent(selEvent); setShowForm(true); setFormData({ title: selEvent.title, tagline: selEvent.tagline||"", description: selEvent.description||"", startAt: selEvent.startAt?.slice(0,16)||"", endAt: selEvent.endAt?.slice(0,16)||"", status: selEvent.status, is_featured: selEvent.is_featured }); }} className="btn-glass-secondary">Edit</button>
                  <button onClick={() => setActiveTab("locations")} className="btn-glass-secondary">+ Lokasi</button>
                  <button onClick={() => setActiveTab("tikums")} className="btn-glass-secondary">+ Tikum</button>
                  {!selEvent.is_featured
                    ? <button onClick={() => publishEvent(selEvent.id, true)} style={{padding:"0.6rem 1.25rem",borderRadius:"9999px",fontSize:"0.85rem",background:"rgba(0,232,123,0.15)",border:"1px solid rgba(0,232,123,0.3)",color:"var(--color-green-neon)",cursor:"pointer"}}>⭐ Featured</button>
                    : <button onClick={() => publishEvent(selEvent.id, false)} style={{padding:"0.6rem 1.25rem",borderRadius:"9999px",fontSize:"0.85rem",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"var(--color-text-secondary)",cursor:"pointer"}}>Hapus Featured</button>
                  }
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Event Tab ── */}
        {activeTab === "event" && (
          <>
            {!showForm && (
              <button onClick={() => { setShowForm(true); setEditingEvent(null); setFormData({ title: "", tagline: "", description: "", startAt: "", endAt: "", status: "PUBLISHED", is_featured: false }); }} className="btn-glass-primary" style={{ marginBottom: "1.5rem" }}>+ Buat Event</button>
            )}
            {showForm && (
              <div className="glass-panel-lg p-6 mb-6">
                <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>{editingEvent ? "Edit Event" : "Buat Event Baru"}</h3>
                <div className="space-y-3">
                  <input placeholder="Judul *" value={formData.title} onChange={(e) => setFormData({...formData,title:e.target.value})} className="input-glass" />
                  <input placeholder="Tagline" value={formData.tagline} onChange={(e) => setFormData({...formData,tagline:e.target.value})} className="input-glass" />
                  <textarea placeholder="Deskripsi" value={formData.description} onChange={(e) => setFormData({...formData,description:e.target.value})} className="input-glass" rows={3} />
                  <input type="datetime-local" value={formData.startAt} onChange={(e) => setFormData({...formData,startAt:e.target.value})} className="input-glass" />
                  <input type="datetime-local" value={formData.endAt} onChange={(e) => setFormData({...formData,endAt:e.target.value})} className="input-glass" />
                  <select value={formData.status} onChange={(e) => setFormData({...formData,status:e.target.value})} className="input-glass">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DONE">Selesai</option>
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({...formData,is_featured:e.target.checked})} id="featured" />
                    <label htmlFor="featured" style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Featured di Beranda</label>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={handleSaveEvent} className="btn-glass-primary" style={{ padding: "0.6rem 1.5rem", fontSize: "0.9rem" }}>Simpan</button>
                    <button onClick={() => setShowForm(false)} style={{ padding: "0.6rem 1.5rem", background: "transparent", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>Batal</button>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {events.map((e: any) => (
                <div key={e.id} className="glass-panel p-5" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h3 style={{ fontWeight: 700 }}>{e.title}</h3>
                    <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>{new Date(e.startAt).toLocaleDateString("id-ID")} · {e.status}{e.is_featured && <span style={{ marginLeft: "0.5rem", color: "var(--color-green-neon)" }}>⭐</span>}</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => { setEditingEvent(e); setShowForm(true); setFormData({title:e.title,tagline:e.tagline||"",description:e.description||"",startAt:e.startAt?.slice(0,16)||"",endAt:e.endAt?.slice(0,16)||"",status:e.status,is_featured:e.is_featured}); }} style={{padding:"0.4rem 1rem",borderRadius:"9999px",fontSize:"0.8rem",background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa",cursor:"pointer"}}>Edit</button>
                    {!e.is_featured && (
                      <button onClick={() => publishEvent(e.id, true)} style={{padding:"0.4rem 1rem",borderRadius:"9999px",fontSize:"0.8rem",background:"rgba(0,232,123,0.15)",border:"1px solid rgba(0,232,123,0.3)",color:"var(--color-green-neon)",cursor:"pointer"}}>⭐</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Locations Tab ── */}
        {activeTab === "locations" && (
          <div>
            <div className="glass-panel-lg p-6 mb-6">
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Tambah Start / Finish</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <select value={locationForm.type} onChange={(e) => setLocationForm({...locationForm,type:e.target.value})} className="input-glass">
                  <option value="START">Start</option><option value="FINISH">Finish</option>
                </select>
                <input placeholder="Nama Lokasi" value={locationForm.name} onChange={(e) => setLocationForm({...locationForm,name:e.target.value})} className="input-glass" />
                <input placeholder="Jam" value={locationForm.time} onChange={(e) => setLocationForm({...locationForm,time:e.target.value})} className="input-glass" />
                <input placeholder="Latitude *" value={locationForm.lat} onChange={(e) => setLocationForm({...locationForm,lat:e.target.value})} className="input-glass" />
                <input placeholder="Longitude *" value={locationForm.lng} onChange={(e) => setLocationForm({...locationForm,lng:e.target.value})} className="input-glass" />
              </div>
              <button onClick={handleAddLocation} className="btn-glass-primary" style={{ marginTop: "1rem" }}>Tambah</button>
            </div>
            <div className="space-y-3">
              <h4 style={{ fontWeight: 600 }}>Data lokasi ({locations.length}):</h4>
              {locations.length === 0 && <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.9rem" }}>Belum ada lokasi untuk event ini.</p>}
              {locations.map((l: any) => (
                <div key={l.id} className="glass-panel p-4">
                  {editingLocationId === l.id ? (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <select
                          value={locationEdit.type}
                          onChange={(e) => setLocationEdit({ ...locationEdit, type: e.target.value })}
                          className="input-glass"
                        >
                          <option value="START">Start</option>
                          <option value="FINISH">Finish</option>
                        </select>
                        <input
                          placeholder="Nama Lokasi *"
                          value={locationEdit.name}
                          onChange={(e) => setLocationEdit({ ...locationEdit, name: e.target.value })}
                          className="input-glass"
                        />
                        <input
                          placeholder="Jam (cth: 16:30)"
                          value={locationEdit.time}
                          onChange={(e) => setLocationEdit({ ...locationEdit, time: e.target.value })}
                          className="input-glass"
                        />
                        <input
                          placeholder="Latitude *"
                          value={locationEdit.lat}
                          onChange={(e) => setLocationEdit({ ...locationEdit, lat: e.target.value })}
                          className="input-glass"
                        />
                        <input
                          placeholder="Longitude *"
                          value={locationEdit.lng}
                          onChange={(e) => setLocationEdit({ ...locationEdit, lng: e.target.value })}
                          className="input-glass"
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => handleUpdateLocation(l.id)}
                          className="btn-glass-primary"
                          style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem" }}
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingLocationId(null)}
                          className="btn-glass-secondary"
                          style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem" }}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span>{l.type === "START" ? "🟣" : "🔴"}</span>
                      <span style={{ fontWeight: 600 }}>{l.type === "START" ? "Start" : "Finish"}: {l.name}</span>
                      {l.time && <span style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>({l.time})</span>}
                      <span style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem", marginLeft: "auto" }}>{l.lat}, {l.lng}</span>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "0.5rem" }}>
                          <button
                            onClick={() => startEditLocation(l)}
                            style={{
                              padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem",
                              background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
                              color: "#a78bfa", cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(l.id)}
                            style={{
                              padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem",
                              background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                              color: "#f43f5e", cursor: "pointer",
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tikums Tab ── */}
        {activeTab === "tikums" && (
          <div>
            <div className="glass-panel-lg p-6 mb-6">
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Tambah Tikum</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "0.75rem" }}>
                <input placeholder="Nama Tikum *" value={tikusmForm.name} onChange={(e) => setTikusmForm({...tikusmForm,name:e.target.value})} className="input-glass" />
                <input placeholder="Jam Kumpul" value={tikusmForm.meet_time} onChange={(e) => setTikusmForm({...tikusmForm,meet_time:e.target.value})} className="input-glass" />
                <input placeholder="Latitude *" value={tikusmForm.lat} onChange={(e) => setTikusmForm({...tikusmForm,lat:e.target.value})} className="input-glass" />
                <input placeholder="Longitude *" value={tikusmForm.lng} onChange={(e) => setTikusmForm({...tikusmForm,lng:e.target.value})} className="input-glass" />
                <input placeholder="Kuota" value={tikusmForm.quota} onChange={(e) => setTikusmForm({...tikusmForm,quota:e.target.value})} className="input-glass" />
                <input placeholder="Kontak PIC" value={tikusmForm.contact} onChange={(e) => setTikusmForm({...tikusmForm,contact:e.target.value})} className="input-glass" />
                {isAdmin && (
                  <select value={tikusmForm.coordinatorId} onChange={(e) => setTikusmForm({...tikusmForm,coordinatorId:e.target.value})} className="input-glass">
                    <option value="">— Koordinator (opsional) —</option>
                    {coordinators.map((u: any) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                  </select>
                )}
              </div>
              <button onClick={handleAddTikum} className="btn-glass-primary" style={{ marginTop: "1rem" }}>Tambah</button>
            </div>
            <div className="space-y-3">
              <h4 style={{ fontWeight: 600 }}>Tikum terdaftar ({myTikums.length}):</h4>
              {myTikums.length === 0 && <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.9rem" }}>{isAdmin ? "Belum ada Tikum untuk event ini." : "Anda belum dikaitkan sebagai koordinator Tikum mana pun."}</p>}
              {myTikums.map((tk: any) => (
                <div key={tk.id} className="glass-panel p-4">
                  {editingTikumId === tk.id ? (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "0.5rem" }}>
                        <input placeholder="Nama" value={tikumEdit.name} onChange={(e) => setTikumEdit({...tikumEdit,name:e.target.value})} className="input-glass" />
                        <input placeholder="Jam Kumpul" value={tikumEdit.meet_time} onChange={(e) => setTikumEdit({...tikumEdit,meet_time:e.target.value})} className="input-glass" />
                        <input placeholder="Kuota" value={tikumEdit.quota} onChange={(e) => setTikumEdit({...tikumEdit,quota:e.target.value})} className="input-glass" />
                        <input placeholder="Kontak PIC" value={tikumEdit.contact} onChange={(e) => setTikumEdit({...tikumEdit,contact:e.target.value})} className="input-glass" />
                        <input placeholder="Latitude" value={tikumEdit.lat} onChange={(e) => setTikumEdit({...tikumEdit,lat:e.target.value})} className="input-glass" />
                        <input placeholder="Longitude" value={tikumEdit.lng} onChange={(e) => setTikumEdit({...tikumEdit,lng:e.target.value})} className="input-glass" />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <button onClick={() => handleUpdateTikum(tk.id)} className="btn-glass-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}>Simpan</button>
                        <button onClick={() => setEditingTikumId(null)} style={{ padding: "0.5rem 1.25rem", background: "transparent", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <span style={{fontWeight:600,color:"var(--color-purple-tikum)"}}>{tk.name}</span>
                        {tk.meetTime && <span style={{color:"var(--color-text-tertiary)",fontSize:"0.85rem",marginLeft:"0.5rem"}}>{tk.meetTime}</span>}
                        <div style={{fontSize:"0.8rem",color:"var(--color-text-tertiary)",marginTop:"0.25rem"}}>{tk.attendeeCount ?? 0} peserta · {tk.lat}, {tk.lng}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        {isAdmin ? (
                          <>
                            <span style={{fontSize:"0.8rem",color:"var(--color-text-tertiary)"}}>👤</span>
                            <select value={tk.coordinatorId || ""} onChange={(e) => handleAssignCoordinator(tk.id, e.target.value)} className="input-glass" style={{ maxWidth: "200px" }}>
                              <option value="">— Tanpa koordinator —</option>
                              {coordinators.map((u: any) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                            </select>
                          </>
                        ) : (
                          <span style={{fontSize:"0.8rem",color:"var(--color-text-tertiary)"}}>👤 {tk.coordinatorName || "Tanpa koordinator"}</span>
                        )}
                        <button onClick={() => startEditTikum(tk)} style={{padding:"0.4rem 0.9rem",borderRadius:"9999px",fontSize:"0.8rem",background:"rgba(167,139,250,0.15)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa",cursor:"pointer"}}>Edit</button>
                        <button onClick={() => handleDeleteTikum(tk.id)} style={{padding:"0.4rem 0.9rem",borderRadius:"9999px",fontSize:"0.8rem",background:"rgba(244,63,94,0.15)",border:"1px solid rgba(244,63,94,0.3)",color:"var(--color-red-finish)",cursor:"pointer"}}>Hapus</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Attendees Tab ── */}
        {activeTab === "attendees" && (
          <div className="glass-panel-lg p-6">
            <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Daftar Peserta ({attendances.length})</h3>
            {attendances.length === 0 && <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.9rem" }}>Belum ada peserta untuk event ini.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.75rem" }}>
              {attendances.map((att: any) => (
                <div key={att.id} className="glass-panel p-4">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{att.displayName}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-text-tertiary)" }}>{att.email}</div>
                    </div>
                    <span style={{fontSize:"0.75rem",padding:"0.2rem 0.6rem",borderRadius:"9999px",background:att.status==="ON_THE_WAY"?"rgba(0,232,123,0.15)":"rgba(255,255,255,0.06)",color:att.status==="ON_THE_WAY"?"var(--color-green-neon)":"var(--color-text-secondary)"}}>{att.status.replace("_"," ")}</span>
                  </div>
                  <div style={{fontSize:"0.8rem",color:"var(--color-text-tertiary)",marginTop:"0.5rem"}}>Tikum: {att.tikumName || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div>
            <div className="glass-panel-lg p-6 mb-6">
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Buat Akun</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "0.75rem" }}>
                <input placeholder="Nama *" value={userForm.displayName} onChange={(e) => setUserForm({...userForm,displayName:e.target.value})} className="input-glass" />
                <input placeholder="Email *" value={userForm.email} onChange={(e) => setUserForm({...userForm,email:e.target.value})} className="input-glass" />
                <input type="password" placeholder="Password * (min 6)" value={userForm.password} onChange={(e) => setUserForm({...userForm,password:e.target.value})} className="input-glass" />
                <select value={userForm.role} onChange={(e) => setUserForm({...userForm,role:e.target.value})} className="input-glass">
                  <option value="TIKUM_COORDINATOR">Koordinator Tikum</option>
                  <option value="USER">Rider</option>
                  <option value="ADMIN">Admin</option>
                </select>
                {userForm.role === "TIKUM_COORDINATOR" && (
                  <select value={userForm.tikumId} onChange={(e) => setUserForm({...userForm,tikumId:e.target.value})} className="input-glass">
                    <option value="">— Assign ke Tikum (opsional) —</option>
                    {tikums.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <button onClick={handleCreateUser} className="btn-glass-primary" style={{ marginTop: "1rem" }}>Buat Akun</button>
            </div>
            <div className="space-y-3">
              <h4 style={{ fontWeight: 600 }}>Pengguna ({users.length}):</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.75rem" }}>
                {users.map((u: any) => (
                  <div key={u.id} className="glass-panel p-4">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.displayName}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--color-text-tertiary)" }}>{u.email}</div>
                      </div>
                      <span style={{fontSize:"0.7rem",padding:"0.2rem 0.6rem",borderRadius:"9999px",whiteSpace:"nowrap",background:u.role==="USER"?"rgba(255,255,255,0.06)":u.role==="ADMIN"?"rgba(244,63,94,0.15)":"rgba(167,139,250,0.15)",color:u.role==="USER"?"var(--color-text-secondary)":u.role==="ADMIN"?"var(--color-red-finish)":"var(--color-purple-tikum)"}}>{u.role.replace("_"," ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

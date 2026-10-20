"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API_BASE } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Password tidak cocok");
      return;
    }
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          displayName: form.displayName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registrasi gagal");
        setLoading(false);
        return;
      }

      // Auto-login after registration
      localStorage.setItem("token", "registered");
      localStorage.setItem("userId", "new_user");
      router.push("/dashboard");
    } catch {
      setError("Terjadi kesalahan koneksi");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-20 pb-16">
      <Navbar />
      <div className="max-w-md mx-auto px-4 fade-in">
        <h1 className="heading-display text-3xl mb-8 text-center">Daftar</h1>

        <form onSubmit={handleSubmit} className="glass-panel-lg p-6 space-y-4">
          {error && (
            <div style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "12px", padding: "0.75rem", color: "#f43f5e", fontSize: "0.9rem" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.9rem" }}>Nama Tampilan</label>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Nama yang tampil di peta"
              className="input-glass"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.9rem" }}>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@contoh.com"
              className="input-glass"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.9rem" }}>Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimal 6 karakter"
              className="input-glass"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.9rem" }}>Ulangi Password</label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Ulangi password"
              className="input-glass"
            />
          </div>

          <button type="submit" className="btn-glass-primary w-full" disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </button>

          <p style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>
            Sudah punya akun?{" "}
            <Link href="/login" style={{ color: "var(--color-purple-tikum)", fontWeight: 500 }}>Masuk</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

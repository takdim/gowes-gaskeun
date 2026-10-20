"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { API_BASE } from "@/lib/api";
import { clearSession } from "@/lib/auth";

export default function LoginContent({ defaultNext }: { defaultNext?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Default redirect: admin → /admin, user → /dashboard
  const getUserRedirect = (role: string) => {
    if (role === "ADMIN" || role === "TIKUM_COORDINATOR") return "/admin";
    return "/dashboard";
  };

  const nextUrl = searchParams.get("next") || defaultNext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // No credentials here — we use Bearer token via localStorage, not cookies
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        let msg = "Login gagal";
        try {
          const d = await res.json();
          msg = d.error || msg;
        } catch {}
        setError(msg);
        setLoading(false);
        return;
      }

      const data = await res.json();
      clearSession();
      // Save session to localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.id);
      localStorage.setItem("role", data.role);
      localStorage.setItem("displayName", data.displayName);

      // Redirect based on role
      let target = data.role === "ADMIN" || data.role === "TIKUM_COORDINATOR" ? "/admin" : "/dashboard";
      if (nextUrl) {
        // Honor next param if user has access
        if (target === "/admin" && ["/admin", "/dashboard", "/live"].includes(nextUrl)) {
          target = nextUrl;
        } else if (target === "/dashboard" && ["/dashboard", "/live"].includes(nextUrl)) {
          target = nextUrl;
        }
      }
      router.push(target);
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan koneksi");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-md mx-auto px-4 fade-in">
        <h1 className="heading-display text-3xl mb-8 text-center">Masuk</h1>

        <form onSubmit={handleSubmit} className="glass-panel-lg p-6 space-y-4">
          {error && (
            <div style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "12px", padding: "0.75rem", color: "#f43f5e", fontSize: "0.9rem" }}>
              {error}
            </div>
          )}

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

          <button type="submit" className="btn-glass-primary w-full" disabled={loading}>
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <p style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>
            Belum punya akun?{" "}
            <a href="/register" style={{ color: "var(--color-purple-tikum)", fontWeight: 500 }}>Daftar dulu</a>
          </p>
        </form>
      </div>
    </main>
  );
}

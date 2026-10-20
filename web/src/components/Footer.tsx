"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2rem 1rem", marginTop: "auto" }}>
      <div className="max-w-4xl mx-auto text-center" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Link href="/" className="inline-block mb-3" aria-label="Beranda">
          <img
            src="/logo.png"
            alt="Gowes Gaskeun Logo"
            width={48}
            height={48}
            style={{
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 4px 16px rgba(0,232,123,0.15)",
              objectFit: "cover",
            }}
          />
        </Link>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>
          © 2025 Gowes Gaskeun — Critical Mass Makassar
        </p>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
          Bergerak Bersama, Merayakan Kota 🚲
        </p>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2rem 1rem", marginTop: "auto" }}>
      <div className="max-w-4xl mx-auto text-center">
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

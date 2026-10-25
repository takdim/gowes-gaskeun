"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { API_BASE } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setRole(localStorage.getItem("role"));
    setDisplayName(localStorage.getItem("displayName") || "");
    setIsLoggedIn(Boolean(getToken()));
    setMounted(true);
  }, []);

  // Tempelkan menu ke tombol user. Desktop: navbar di atas → menu ke bawah.
  // Mobile (≤768px): navbar di bawah → menu ke atas.
  const placeMenu = () => {
    const el = userBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const right = Math.max(12, window.innerWidth - rect.right);
    if (rect.top > window.innerHeight / 2) {
      setMenuStyle({ right, bottom: window.innerHeight - rect.top + 8, top: "auto" });
    } else {
      setMenuStyle({ right, top: rect.bottom + 8, bottom: "auto" });
    }
  };

  const toggleMenu = () => {
    // Hitung posisi sebelum render supaya menu tidak "melompat".
    if (!showMenu) placeMenu();
    setShowMenu((prev) => !prev);
  };

  useEffect(() => {
    if (!showMenu) return;
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [showMenu]);

  const isAdmin = role === "ADMIN" || role === "TIKUM_COORDINATOR";
  const isAdminPage = pathname?.startsWith("/admin");

  const NAV_ITEMS = [
    { href: "/", label: "Beranda" },
    { href: "/event", label: "Event" },
    { href: "/tikum", label: "Tikum" },
    { href: "/live", label: "Live Map" },
    { href: "/dashboard", label: "Aktivitas" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] as any : []),
  ];

  const handleLogout = async () => {
    await logout(API_BASE);
    router.push("/");
  };

  return (
    <>
      <nav className="navbar-glass">
        <Link
          href="/"
          className="nav-link"
          style={{ padding: "0.25rem 0.5rem", display: "flex", alignItems: "center" }}
          aria-label="Beranda"
        >
          <img
            src="/logo.png"
            alt="Logo"
            width={26}
            height={26}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        </Link>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* User menu button — selalu terlihat, juga di mobile */}
        <button
          ref={userBtnRef}
          className="nav-user-btn"
          onClick={toggleMenu}
          aria-label="Menu akun"
          aria-haspopup="menu"
          aria-expanded={showMenu}
        >
          {mounted && isLoggedIn ? (isAdmin ? "👤" : displayName?.[0]?.toUpperCase() || "U") : "↪"}
        </button>
      </nav>

      {/* Dropdown menu */}
      {showMenu && (
        <div style={{
          position: "fixed", zIndex: 60,
          minWidth: "200px",
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(32px) saturate(160%)",
          WebkitBackdropFilter: "blur(32px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          padding: "0.5rem",
          ...menuStyle,
        }} onClick={(e) => e.stopPropagation()}>
          {mounted && isLoggedIn && displayName && (
            <div style={{ padding: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "0.25rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{displayName}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>{role?.replace("_", " ")}</div>
            </div>
          )}
          {mounted && isLoggedIn ? (
            <>
              {!isAdminPage && (
                <Link href="/dashboard" className="nav-link" style={{ width: "100%", display: "block" }}>
                  Dashboard Saya
                </Link>
              )}
              <button onClick={handleLogout} style={{
                width: "100%", padding: "0.5rem 1rem",
                background: "none", border: "none",
                color: "#f43f5e", cursor: "pointer", fontSize: "0.9rem",
                textAlign: "left",
              }}>
                Keluar
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-link" style={{ width: "100%", display: "block" }}>
              Masuk
            </Link>
          )}
        </div>
      )}
    </>
  );
}

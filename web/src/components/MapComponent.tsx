"use client";

import { useEffect, useRef, useState } from "react";

interface MarkerItem {
  lat: number;
  lng: number;
  label: string;
  color?: string;
}

interface MapComponentProps {
  markers?: MarkerItem[];
  center?: [number, number];
  zoom?: number;
  showLegend?: boolean;
  polyline?: [number, number][];
  polylineColor?: string;
  height?: string;
  interactive?: boolean;
}

export default function MapComponent({
  markers = [],
  center = [-5.1486, 119.4390],
  zoom = 14,
  showLegend = false,
  polyline = [],
  polylineColor = "#00e87b",
  height = "100%",
  interactive = true,
}: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const startEndMarkerRefs = useRef<any[]>([]);
  const didFitRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Custom icon factory
  const createIcon = (label: string, color: string) => {
    const L = (window as any).L;
    if (!L || !L.divIcon) return undefined;
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        width: 32px; height: 32px;
        background: ${color || "#a78bfa"};
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
      ">🚲</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = (window as any).L;
    if (!L) {
      setError("Leaflet belum dimuat");
      return;
    }

    const map = L.map(containerRef.current, {
      center: [center[0], center[1]],
      zoom,
      zoomControl: interactive,
      attributionControl: false,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive ? "center" : false,
      doubleClickZoom: interactive,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [JSON.stringify(center), zoom, interactive]);

  // Update polyline if provided
  useEffect(() => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    startEndMarkerRefs.current.forEach((m) => m.remove());
    startEndMarkerRefs.current = [];

    if (polyline && polyline.length > 1) {
      const line = L.polyline(polyline, {
        color: polylineColor,
        weight: 4,
        opacity: 0.9,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(mapRef.current);

      polylineRef.current = line;

      // Start circle marker
      const startPos = polyline[0];
      const startMarker = L.circleMarker(startPos, {
        radius: 6,
        fillColor: "#00e87b",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup("Titik Awal");

      // End circle marker
      const endPos = polyline[polyline.length - 1];
      const endMarker = L.circleMarker(endPos, {
        radius: 6,
        fillColor: "#f43f5e",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup("Titik Selesai");

      startEndMarkerRefs.current = [startMarker, endMarker];

      try {
        mapRef.current.fitBounds(line.getBounds(), { padding: [25, 25], maxZoom: 16 });
      } catch {}
    }
  }, [JSON.stringify(polyline), polylineColor]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    const bounds: [number, number][] = [];

    markers.forEach((m) => {
      const icon = createIcon(m.label, m.color || "#a78bfa");
      const pos: [number, number] = [m.lat, m.lng];
      const marker = L.marker(pos, { icon })
        .bindPopup(`<strong>${m.label}</strong>`)
        .addTo(mapRef.current);
      markerRefs.current.push(marker);
      bounds.push(pos);
    });

    if (bounds.length > 0 && (!polyline || polyline.length === 0) && !didFitRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      didFitRef.current = true;
    }
  }, [markers]);

  if (error) {
    return (
      <div ref={containerRef} style={{
        width: "100%", height, minHeight: height === "100%" ? "260px" : height,
        background: "rgba(244,63,94,0.1)", borderRadius: "24px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "0.5rem"
      }}>
        <span style={{ fontSize: "1.5rem" }}>⚠️</span>
        <span style={{ color: "#f43f5e", fontSize: "0.9rem" }}>{error}</span>
        <button onClick={() => window.location.reload()} style={{
          padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.85rem",
          background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
          color: "#f43f5e", cursor: "pointer"
        }}>Reload halaman</button>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height, minHeight: height === "100%" ? "260px" : height, borderRadius: "inherit" }} />
      {showLegend && (
        <div style={{ padding: "0.75rem 1rem", display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} /> Tikum
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f43f5e", display: "inline-block" }} /> Finish
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#00e87b", display: "inline-owned" }} /> Rider
          </span>
        </div>
      )}
      <style>{`
        .leaflet-control-zoom { border: none !important; }
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.1) !important;
          backdrop-filter: blur(10px) !important;
          color: white !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 8px !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(255,255,255,0.15) !important;
        }
      `}</style>
    </>
  );
}

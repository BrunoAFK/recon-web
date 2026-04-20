import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RendererProps } from "./types";
import { KeyValueTable, SectionLabel } from "./primitives";

interface ServerLocationData {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  org?: string;
  as?: string;
}

function LocationMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 18,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width: 14px; height: 14px;
        background: #22c55e;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 8px rgba(34,197,94,0.6);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    L.marker([lat, lng], { icon }).addTo(map).bindPopup(label);

    mapRef.current = map;

    // Leaflet miscalculates the center when the container isn't fully laid out yet.
    // Wait for tiles to load, then force correct center.
    map.whenReady(() => {
      map.invalidateSize();
      map.setView([lat, lng], 4);
    });
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.setView([lat, lng], 4);
    }, 300);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-border/30"
      style={{ height: 240 }}
    />
  );
}

function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function ServerLocationRenderer({ data }: RendererProps) {
  const loc = (data ?? {}) as ServerLocationData;

  if (loc.latitude == null || loc.longitude == null) {
    return <span className="text-sm text-muted">No location data available</span>;
  }

  const flag = loc.countryCode ? ` ${countryFlag(loc.countryCode)}` : "";
  const cityLabel = [loc.city, loc.region].filter(Boolean).join(", ");

  const items: { label: string; value: React.ReactNode }[] = [
    ...(cityLabel ? [{ label: "City", value: cityLabel }] : []),
    ...(loc.country
      ? [{ label: "Country", value: `${loc.country}${flag}` }]
      : []),
    ...(loc.timezone ? [{ label: "Timezone", value: loc.timezone }] : []),
    ...(loc.isp ? [{ label: "ISP", value: loc.isp }] : []),
    ...(loc.org && loc.org !== loc.isp
      ? [{ label: "Organization", value: loc.org }]
      : []),
    ...(loc.as ? [{ label: "AS", value: loc.as }] : []),
  ];

  const popupLabel = [cityLabel, loc.country].filter(Boolean).join(", ") || loc.ip || "Server";

  return (
    <div className="space-y-4 w-full min-w-0">
      <KeyValueTable items={items} />

      <div>
        <SectionLabel>Location</SectionLabel>
        <LocationMap lat={loc.latitude} lng={loc.longitude} label={popupLabel} />
        <p className="text-xs text-muted mt-1.5 text-right">
          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
        </p>
      </div>
    </div>
  );
}

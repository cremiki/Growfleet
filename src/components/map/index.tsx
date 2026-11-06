"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { LiveMapProps, MapProvider } from "./shared";

export type { MapProvider, RouteOverlay, Focus } from "./shared";

const loading = () => <div className="h-full w-full bg-[#dfe4e8]" aria-busy="true" />;
const Leaflet = dynamic(() => import("./LeafletLiveMap").then((m) => m.LeafletLiveMap), { ssr: false, loading });
const Google = dynamic(() => import("./GoogleLiveMap").then((m) => m.GoogleLiveMap), { ssr: false, loading });

export const googleAvailable = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function LiveMap(p: LiveMapProps & { provider: MapProvider }) {
  return p.provider === "google" && googleAvailable ? <Google {...p} /> : <Leaflet {...p} />;
}

const STORAGE_KEY = "fleet.mapProvider";

/** Preferenza mappa ricordata nel browser */
export function useMapProvider(): [MapProvider, (p: MapProvider) => void] {
  const [p, setP] = useState<MapProvider>("osm");
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "google" && googleAvailable) setP("google");
    } catch { /* storage non disponibile */ }
  }, []);
  const set = (v: MapProvider) => {
    setP(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignora */ }
  };
  return [p, set];
}

export function MapSwitch({ value, onChange }: { value: MapProvider; onChange: (p: MapProvider) => void }) {
  const opt = (id: MapProvider, label: string, disabled = false) => (
    <button type="button" onClick={() => onChange(id)} disabled={disabled} aria-pressed={value === id}
      title={disabled ? "Aggiungi NEXT_PUBLIC_GOOGLE_MAPS_API_KEY per attivare Google Maps" : undefined}
      className={`px-2.5 py-1 text-[13px] font-medium ${value === id ? "bg-ink text-white" : "bg-white text-ink hover:bg-asphalt"} disabled:text-muted/60 disabled:hover:bg-white disabled:cursor-not-allowed`}>
      {label}
    </button>
  );
  return (
    <div className="inline-flex rounded overflow-hidden border border-line shadow-sm" role="group" aria-label="Tipo di mappa">
      {opt("osm", "OpenStreetMap")}
      {opt("google", "Google", !googleAvailable)}
    </div>
  );
}

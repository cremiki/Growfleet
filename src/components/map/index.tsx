"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FleetMapProps, MapProvider, TrackMapProps } from "./shared";

export type { MapProvider } from "./shared";

const loading = () => <div className="h-full w-full bg-[#dfe4e8]" aria-busy="true" />;

const LeafletFleet = dynamic(() => import("./LeafletMaps").then((m) => m.LeafletFleetMap), { ssr: false, loading });
const LeafletTrack = dynamic(() => import("./LeafletMaps").then((m) => m.LeafletTrackMap), { ssr: false, loading });
const GoogleFleet = dynamic(() => import("./GoogleMaps").then((m) => m.GoogleFleetMap), { ssr: false, loading });
const GoogleTrack = dynamic(() => import("./GoogleMaps").then((m) => m.GoogleTrackMap), { ssr: false, loading });

export const googleAvailable = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function FleetMap(p: FleetMapProps & { provider: MapProvider }) {
  return p.provider === "google" && googleAvailable ? <GoogleFleet {...p} /> : <LeafletFleet {...p} />;
}

export function TrackMap(p: TrackMapProps & { provider: MapProvider }) {
  return p.provider === "google" && googleAvailable ? <GoogleTrack {...p} /> : <LeafletTrack {...p} />;
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
      className={`px-3 py-1.5 text-sm font-medium ${value === id ? "bg-ink text-white" : "bg-white text-ink hover:bg-asphalt"} disabled:text-muted/60 disabled:hover:bg-white disabled:cursor-not-allowed`}>
      {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-line shadow-sm" role="group" aria-label="Tipo di mappa">
      {opt("osm", "OpenStreetMap")}
      {opt("google", "Google", !googleAvailable)}
    </div>
  );
}

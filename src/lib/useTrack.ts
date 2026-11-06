"use client";

import { useEffect, useState } from "react";
import type { TrackPoint } from "./types";

/** Punti del percorso di un veicolo in un intervallo; con refreshMs si aggiorna da solo */
export function useTrack(id: number, from: number, to: number, refreshMs?: number) {
  const [points, setPoints] = useState<TrackPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPoints(null);
    setError(null);
    const load = async () => {
      try {
        const end = refreshMs ? Math.floor(Date.now() / 1000) : to;
        const r = await fetch(`/api/vehicles/${id}/track?from=${Math.floor(from)}&to=${Math.ceil(end)}`, { cache: "no-store" });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || "Impossibile caricare il percorso.");
        if (alive) { setPoints(b.points); setError(null); }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    load();
    const t = refreshMs ? setInterval(() => { if (document.visibilityState === "visible") load(); }, refreshMs) : null;
    return () => { alive = false; if (t) clearInterval(t); };
  }, [id, from, to, refreshMs]);

  return { points, error };
}

export function startOfDay(ts: number) {
  const d = new Date(ts * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

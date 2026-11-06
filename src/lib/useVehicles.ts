"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VehicleState } from "./types";

const REFRESH_S = Math.max(3, Number(process.env.NEXT_PUBLIC_LIVE_REFRESH_SECONDS) || 10);

/**
 * Stato live della flotta: interroga /api/vehicles a intervalli regolari
 * e si mette in pausa quando la scheda del browser non è visibile.
 */
export function useVehicles(cid: number | null) {
  const [vehicles, setVehicles] = useState<VehicleState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    try {
      const res = await fetch(`/api/vehicles${cid ? `?cid=${cid}` : ""}`, { signal: c.signal, cache: "no-store" });
      const body = await res.json();
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error(body.error || "Impossibile caricare i veicoli.");
      setVehicles(body.vehicles);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
  }, [cid]);

  useEffect(() => {
    setVehicles(null);
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_S * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); ctrl.current?.abort(); };
  }, [load]);

  return { vehicles, error, updatedAt, reload: load, refreshSeconds: REFRESH_S };
}

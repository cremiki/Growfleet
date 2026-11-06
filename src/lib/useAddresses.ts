"use client";

import { useEffect, useRef, useState } from "react";

export const geoKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

// Cache condivisa tra componenti per tutta la sessione del browser
const known = new Map<string, string>();
const listeners = new Set<() => void>();

/**
 * Restituisce una funzione address(lat, lon) che dà l'indirizzo se già noto.
 * Chiede al server quelli mancanti; il server ne risolve pochi per volta (limite OpenStreetMap)
 * e qui si richiedono di nuovo finché non sono tutti risolti.
 */
export function useAddresses(points: { lat: number | null; lon: number | null }[]) {
  const [, force] = useState(0);
  const keys = Array.from(new Set(points.filter((p) => p.lat != null && p.lon != null).map((p) => geoKey(p.lat!, p.lon!))));
  const wanted = keys.filter((k) => !known.has(k)).sort().join(";");
  const busy = useRef(false);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (!wanted || busy.current) return;
    let cancelled = false;
    busy.current = true;
    (async () => {
      let todo = wanted.split(";");
      for (let round = 0; round < 15 && todo.length && !cancelled; round++) {
        try {
          const r = await fetch(`/api/geocode?points=${encodeURIComponent(todo.slice(0, 50).join(";"))}`, { cache: "no-store" });
          if (!r.ok) break;
          const b = (await r.json()) as { addresses: Record<string, string>; pending: string[] };
          for (const [k, v] of Object.entries(b.addresses)) known.set(k, v);
          listeners.forEach((f) => f());
          todo = todo.filter((k) => !known.has(k) && (b.pending.includes(k) || todo.indexOf(k) >= 50));
          if (todo.length) await new Promise((res) => setTimeout(res, 800));
        } catch {
          break;
        }
      }
      busy.current = false;
    })();
    return () => { cancelled = true; busy.current = false; };
  }, [wanted]);

  return (lat: number | null, lon: number | null) => (lat == null || lon == null ? undefined : known.get(geoKey(lat, lon)));
}

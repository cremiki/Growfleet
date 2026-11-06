"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapSwitch, TrackMap, useMapProvider } from "@/components/map";
import type { TrackPoint } from "@/lib/types";
import { fmt1, fmtDuration, fmtInt, fmtTime } from "@/lib/format";
import { summarize } from "@/lib/trips";

type Preset = "today" | "yesterday" | "24h" | "custom";

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function toInput(d: Date) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function rangeFor(p: Preset, custom: { from: string; to: string }): [number, number] {
  const now = Date.now() / 1000;
  const today = startOfDay().getTime() / 1000;
  if (p === "today") return [today, now];
  if (p === "yesterday") return [today - 86400, today];
  if (p === "24h") return [now - 86400, now];
  return [new Date(custom.from).getTime() / 1000, new Date(custom.to).getTime() / 1000];
}

export function HistoryView({ id, name }: { id: number; name: string }) {
  const [provider, setProvider] = useMapProvider();
  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState(() => ({ from: toInput(startOfDay()), to: toInput(new Date()) }));
  const [points, setPoints] = useState<TrackPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    const [from, to] = rangeFor(preset, custom);
    if (!(to > from)) { setError("La fine dell'intervallo deve essere dopo l'inizio."); return; }
    setPoints(null); setError(null); setCursor(null); setPlaying(false);
    try {
      const r = await fetch(`/api/vehicles/${id}/track?from=${Math.floor(from)}&to=${Math.ceil(to)}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Impossibile caricare il percorso.");
      setPoints(b.points);
    } catch (e) {
      setError((e as Error).message);
      setPoints([]);
    }
  }, [id, preset, custom]);

  useEffect(() => { if (preset !== "custom") load(); }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => (points ? summarize(points) : null), [points]);

  // Riproduzione del percorso
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || !points?.length) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        const n = (c ?? 0) + 1;
        if (n >= points.length) { setPlaying(false); return points.length - 1; }
        return n;
      });
    }, 120);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, points]);

  const cur = cursor != null && points ? points[cursor] : null;

  return (
    <div className="h-full flex flex-col-reverse md:grid md:grid-cols-[minmax(340px,400px)_1fr]">
      <aside className="flex-1 md:flex-none min-h-0 overflow-y-auto bg-surface border-r border-line">
        <div className="px-4 pt-3">
          <Link href={`/flotta?v=${id}`} className="text-sign font-medium text-sm hover:underline">‹ Torna al veicolo</Link>
        </div>
        <header className="px-4 pt-3">
          <p className="text-sm text-muted">Storico percorsi</p>
          <h1 className="plate text-[28px] font-bold leading-tight">{name}</h1>
        </header>

        <div className="px-4 mt-4">
          <div className="grid grid-cols-4 rounded-md overflow-hidden border border-line text-sm" role="group" aria-label="Periodo">
            {([["today", "Oggi"], ["yesterday", "Ieri"], ["24h", "24 ore"], ["custom", "Date"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPreset(k)} aria-pressed={preset === k}
                className={`py-2 font-medium ${preset === k ? "bg-ink text-white" : "bg-white hover:bg-asphalt"}`}>{l}</button>
            ))}
          </div>
          {preset === "custom" && (
            <form className="mt-3 grid grid-cols-2 gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
              <label className="text-sm">Dal
                <input type="datetime-local" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                  className="mt-1 w-full border border-line rounded-md px-2 py-1.5" required />
              </label>
              <label className="text-sm">Al
                <input type="datetime-local" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                  className="mt-1 w-full border border-line rounded-md px-2 py-1.5" required />
              </label>
              <button className="col-span-2 bg-sign hover:bg-sign-dark text-white font-semibold rounded-md py-2">Mostra percorso</button>
              <p className="col-span-2 text-xs text-muted">Massimo 7 giorni per volta.</p>
            </form>
          )}
        </div>

        {error && <p role="alert" className="mx-4 mt-4 text-offline text-sm">{error}</p>}
        {!points && !error && <p className="mx-4 mt-4 text-muted">Caricamento del percorso…</p>}

        {summary && points && points.length > 0 && (
          <>
            <dl className="grid grid-cols-2 mx-4 mt-4 border-t border-l border-line">
              <Stat label="Distanza" value={`${fmt1(summary.km)} km`} />
              <Stat label="Tempo in marcia" value={fmtDuration(summary.drivingS)} />
              <Stat label="Velocità massima" value={`${fmtInt(summary.maxSpeed)} km/h`} />
              <Stat label="Media in marcia" value={`${fmtInt(summary.avgSpeed)} km/h`} />
            </dl>
            <section className="mx-4 my-5">
              <h2 className="font-semibold border-b border-line pb-2">
                {summary.trips.length === 1 ? "1 viaggio" : `${summary.trips.length} viaggi`}
              </h2>
              <ol>
                {summary.trips.map((t, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => { setPlaying(false); setCursor(t.startIdx); }}
                      className="w-full text-left flex justify-between gap-3 py-2.5 border-b border-line/70 hover:bg-asphalt/50 px-1">
                      <span>
                        <span className="plate font-semibold text-[17px]">{fmtTime(t.start)} – {fmtTime(t.end)}</span>
                        <span className="block text-xs text-muted">{fmtDuration(t.end - t.start)}, max {fmtInt(t.maxSpeed)} km/h</span>
                      </span>
                      <span className="plate font-semibold text-[17px] whitespace-nowrap">{fmt1(t.km)} km</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
        {points && points.length === 0 && !error && (
          <div className="mx-4 mt-4 text-muted leading-relaxed">
            <p className="font-semibold text-ink">Nessuna posizione in questo periodo</p>
            <p className="mt-1">Il veicolo era fermo oppure il dispositivo non ha inviato dati. Prova un periodo diverso.</p>
          </div>
        )}
      </aside>

      <section className="relative h-[50vh] md:h-auto min-h-0">
        <TrackMap provider={provider} points={points ?? []} cursor={cursor} />
        <div className="absolute top-3 right-3 z-[1000]"><MapSwitch value={provider} onChange={setProvider} /></div>
        {points && points.length > 1 && (
          <div className="absolute left-3 right-3 bottom-3 z-[1000] bg-white/95 border border-line rounded-md shadow-sm px-3 py-2 flex items-center gap-3">
            <button type="button" onClick={() => { if (cursor === points.length - 1) setCursor(0); setPlaying(!playing); }}
              className="bg-ink text-white rounded-md px-3 py-1.5 text-sm font-semibold w-24">
              {playing ? "Pausa" : "Riproduci"}
            </button>
            <input type="range" min={0} max={points.length - 1} value={cursor ?? 0} aria-label="Posizione nel percorso"
              onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }} className="flex-1 accent-[#0b4f9c]" />
            <span className="plate text-[15px] font-semibold w-36 text-right whitespace-nowrap">
              {cur ? `${fmtTime(cur.ts)}, ${fmtInt(cur.speed)} km/h` : `${points.length} punti`}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-b border-line px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="plate text-xl font-semibold mt-0.5">{value}</dd>
    </div>
  );
}

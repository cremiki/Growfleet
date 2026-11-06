"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportDef } from "@/lib/reports/catalog";
import type { Column, ReportInput, ReportResult } from "@/lib/reports/types";
import { isPlace } from "@/lib/reports/types";
import { cellCsv, cellText, NUMERIC, UNIT } from "@/lib/reports/format";
import { useAddresses } from "@/lib/useAddresses";
import { useFavorites } from "../ReportCatalog";

type V = { id: number; name: string };

const d2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
const startOf = (s: string) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  { id: "today", label: "Oggi", range: () => [ymd(new Date()), ymd(new Date())] },
  { id: "yesterday", label: "Ieri", range: () => [ymd(addDays(new Date(), -1)), ymd(addDays(new Date(), -1))] },
  { id: "7d", label: "Ultimi 7 giorni", range: () => [ymd(addDays(new Date(), -6)), ymd(new Date())] },
  { id: "month", label: "Questo mese", range: () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(n)]; } },
  { id: "lastmonth", label: "Mese scorso", range: () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), ymd(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
];

export function ReportView({ def }: { def: ReportDef }) {
  const has = (p: string) => def.params.includes(p as never);
  const [favs, toggleFav] = useFavorites();
  const [vehicles, setVehicles] = useState<V[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]); // vuoto = tutti
  const [single, setSingle] = useState<number | null>(null);
  const [fromDay, setFromDay] = useState(ymd(new Date()));
  const [toDay, setToDay] = useState(ymd(new Date()));
  const [useTime, setUseTime] = useState(false);
  const [timeFrom, setTimeFrom] = useState("00:00");
  const [timeTo, setTimeTo] = useState("23:59");
  const [month, setMonth] = useState(() => ymd(new Date()).slice(0, 7));
  const [at, setAt] = useState(() => `${ymd(new Date())}T${d2(new Date().getHours())}:00`);
  const [speedLimit, setSpeedLimit] = useState(130);
  const [minStop, setMinStop] = useState(5);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/vehicles", { cache: "no-store" }).then((r) => r.json()).then((b) => {
      const list: V[] = (b.vehicles ?? []).map((v: V) => ({ id: v.id, name: v.name }));
      setVehicles(list);
      if (list.length) setSingle(list[0].id);
    }).catch(() => setVehicles([]));
  }, []);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: ReportInput = { vehicleIds: has("vehicle") ? (single ? [single] : []) : selected };
    if (has("period")) {
      input.from = startOf(fromDay);
      input.to = startOf(toDay) + 86400;
      if (input.to <= input.from) { setError("La data di fine deve essere uguale o successiva a quella di inizio."); return; }
    }
    if (has("timeRange") && useTime) { input.timeFrom = timeFrom; input.timeTo = timeTo; }
    if (has("month")) input.month = month;
    if (has("datetime")) input.at = Math.floor(new Date(at).getTime() / 1000);
    if (has("speedLimit")) input.speedLimit = speedLimit;
    if (has("minStop")) input.minStop = minStop;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch(`/api/reports/${def.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Il report non è stato generato.");
      setResult(b);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fav = favs.includes(def.id);
  const periodLabel = has("month") ? month : has("datetime") ? at.replace("T", " ") : `${fromDay}${toDay !== fromDay ? ` – ${toDay}` : ""}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="print:hidden">
          <Link href="/report" className="text-sign text-sm font-medium hover:underline">‹ Tutti i report</Link>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-2xl font-semibold">{def.title}</h1>
          <button type="button" onClick={() => toggleFav(def.id)} aria-pressed={fav} className="text-xl print:hidden"
            aria-label={fav ? "Togli dai preferiti" : "Aggiungi ai preferiti"} style={{ color: fav ? "#e0a100" : "#b8c1ca" }}>★</button>
        </div>
        <p className="text-muted mt-1 max-w-3xl print:hidden">{def.description}</p>
        <p className="hidden print:block text-sm">Periodo: {periodLabel}</p>

        <form onSubmit={run} className="mt-4 bg-surface border border-line p-4 flex flex-wrap items-end gap-4 print:hidden">
          {has("vehicles") && <VehiclePicker vehicles={vehicles} selected={selected} onChange={setSelected} />}
          {has("vehicle") && (
            <Field label="Veicolo">
              <select value={single ?? ""} onChange={(e) => setSingle(Number(e.target.value))} className="input w-56">
                {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
          )}
          {has("period") && (
            <>
              <Field label="Periodo rapido">
                <select defaultValue="" onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) { const [a, b] = p.range(); setFromDay(a); setToDay(b); } }} className="input w-40">
                  <option value="" disabled>Scegli…</option>
                  {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Dal"><input type="date" value={fromDay} max={ymd(new Date())} onChange={(e) => setFromDay(e.target.value)} className="input" required /></Field>
              <Field label="Al"><input type="date" value={toDay} max={ymd(new Date())} onChange={(e) => setToDay(e.target.value)} className="input" required /></Field>
            </>
          )}
          {has("timeRange") && (
            <Field label="Fascia oraria">
              <span className="flex items-center gap-1.5">
                <input type="checkbox" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} aria-label="Limita a una fascia oraria" />
                <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} disabled={!useTime} className="input w-28" aria-label="Dalle" />
                <span className="text-muted">–</span>
                <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} disabled={!useTime} className="input w-28" aria-label="Alle" />
              </span>
            </Field>
          )}
          {has("month") && <Field label="Mese"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" required /></Field>}
          {has("datetime") && <Field label="Data e ora"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="input" required /></Field>}
          {has("speedLimit") && <Field label="Limite (km/h)"><input type="number" min={5} max={300} value={speedLimit} onChange={(e) => setSpeedLimit(Number(e.target.value))} className="input w-24" /></Field>}
          {has("minStop") && <Field label="Fermate di almeno (min)"><input type="number" min={1} max={1440} value={minStop} onChange={(e) => setMinStop(Number(e.target.value))} className="input w-24" /></Field>}
          <button disabled={busy || !vehicles} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-5 py-2 disabled:opacity-60">
            {busy ? "Generazione…" : "Genera report"}
          </button>
        </form>

        {busy && <p className="mt-4 text-muted">Sto leggendo i messaggi dei veicoli da flespi: per periodi lunghi può servire fino a un minuto.</p>}
        {error && <p role="alert" className="mt-4 text-offline">{error}</p>}
        {result && <ResultTable id={def.id} title={def.title} result={result} periodLabel={periodLabel} />}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

function VehiclePicker({ vehicles, selected, onChange }: { vehicles: V[] | null; selected: number[]; onChange: (v: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const label = !vehicles ? "Caricamento…" : selected.length === 0 ? `Tutti i veicoli (${vehicles.length})`
    : selected.length === 1 ? vehicles.find((v) => v.id === selected[0])?.name ?? "1 veicolo" : `${selected.length} veicoli`;
  const shown = (vehicles ?? []).filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div ref={ref} className="relative text-sm">
      <span className="block text-muted mb-1">Veicoli</span>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="input w-60 text-left flex justify-between items-center">
        <span className="truncate">{label}</span><span aria-hidden>▾</span>
      </button>
      {open && vehicles && (
        <div className="absolute z-[1500] mt-1 w-72 bg-white border border-line rounded shadow-lg">
          <div className="p-2 border-b border-line">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca" aria-label="Cerca veicolo" className="input w-full" autoFocus />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 border-b border-line font-medium cursor-pointer">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
            Tutti i veicoli
          </label>
          <div className="max-h-64 overflow-y-auto">
            {shown.map((v) => (
              <label key={v.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-asphalt cursor-pointer">
                <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} />
                {v.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- risultati */

function ResultTable({ id, title, result, periodLabel }: { id: string; title: string; result: ReportResult; periodLabel: string }) {
  const storageKey = `fleet.reportCols.${id}`;
  const [hidden, setHidden] = useState<string[]>(() => result.columns.filter((c) => c.optional).map((c) => c.key));
  const [colsOpen, setColsOpen] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setHidden(JSON.parse(s)); } catch { /* ignora */ }
  }, [storageKey]);
  const toggleCol = (k: string) => setHidden((h) => {
    const n = h.includes(k) ? h.filter((x) => x !== k) : [...h, k];
    try { localStorage.setItem(storageKey, JSON.stringify(n)); } catch { /* ignora */ }
    return n;
  });

  const cols = result.columns.filter((c) => !hidden.includes(c.key));
  const places = useMemo(() => {
    const addrCols = result.columns.filter((c) => c.kind === "address").map((c) => c.key);
    const out: { lat: number; lon: number }[] = [];
    for (const g of result.groups) for (const r of g.rows) for (const k of addrCols) { const v = r[k]; if (isPlace(v)) out.push(v); }
    return out.slice(0, 300);
  }, [result]);
  const address = useAddresses(places);
  const empty = result.groups.every((g) => g.rows.length === 0);
  const wide = cols.length > 14;

  const exportCsv = () => {
    const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const head = (c: Column) => (UNIT[c.kind] && c.kind !== "hours" ? `${c.label} (${UNIT[c.kind]})` : c.label);
    const lines: string[] = [esc(title), esc(`Periodo: ${periodLabel}`), ""];
    const hasGroups = result.groups.some((g) => g.title);
    lines.push([...(hasGroups ? ["Gruppo"] : []), ...cols.map(head)].map(esc).join(";"));
    for (const g of result.groups) {
      for (const r of g.rows) lines.push([...(hasGroups ? [g.title] : []), ...cols.map((c) => cellCsv(c.kind, r[c.key], address))].map(esc).join(";"));
      if (g.totals) lines.push([...(hasGroups ? [`${g.title} totale`] : []), ...cols.map((c) => cellCsv(c.kind, g.totals![c.key] ?? null, address))].map(esc).join(";"));
    }
    if (result.totals) lines.push([...(hasGroups ? ["Totale"] : []), ...cols.map((c) => cellCsv(c.kind, result.totals![c.key] ?? null, address))].map(esc).join(";"));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_")}_${periodLabel.replace(/[^\d-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cell = (c: Column, v: unknown) => cellText(c.kind, (v ?? null) as never, address, c.compact);
  const numeric = (c: Column) => NUMERIC.includes(c.kind);
  const totalLabel = (row: Record<string, unknown>, label: string) => cols.map((c, i) => {
    const v = row[c.key];
    const txt = v === undefined || v === null ? (i === 0 ? label : "") : cell(c, v);
    return <td key={c.key} className={`px-2.5 py-2 font-semibold ${numeric(c) ? "text-right whitespace-nowrap" : ""}`}>{txt}</td>;
  });

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h2 className="text-lg font-semibold mr-auto">Risultati</h2>
        <div className="relative">
          <button type="button" onClick={() => setColsOpen(!colsOpen)} className="border border-line bg-white rounded px-3 py-1.5 text-sm">Colonne</button>
          {colsOpen && (
            <div className="absolute right-0 z-[1500] mt-1 w-60 bg-white border border-line rounded shadow-lg py-1">
              {result.columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-asphalt cursor-pointer">
                  <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => toggleCol(c.key)} />{c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={exportCsv} disabled={empty} className="border border-line bg-white rounded px-3 py-1.5 text-sm disabled:opacity-50">Excel (CSV)</button>
        <button type="button" onClick={() => window.print()} disabled={empty} className="border border-line bg-white rounded px-3 py-1.5 text-sm disabled:opacity-50">Stampa / PDF</button>
      </div>
      {result.notes?.map((n) => <p key={n} className="text-sm text-muted mt-2">{n}</p>)}
      {places.length > 0 && <p className="text-xs text-muted mt-1 print:hidden">Gli indirizzi compaiono man mano che vengono trovati; nel frattempo si vedono le coordinate.</p>}

      {empty ? (
        <p className="mt-4 bg-surface border border-line p-6 text-muted">Nessun dato nel periodo scelto per i veicoli selezionati.</p>
      ) : (
        <div className="mt-3 bg-surface border border-line overflow-x-auto">
          <table className={`w-full ${wide ? "text-xs" : "text-sm"}`}>
            <thead className="bg-asphalt/60 text-left">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={`px-2.5 py-2 font-semibold align-bottom ${numeric(c) ? "text-right" : ""} ${c.weekend ? "bg-[#fbe3dc] text-offline" : ""}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            {result.groups.map((g, gi) => (
              <tbody key={gi}>
                {g.title && (
                  <tr className="bg-ink/85 text-white">
                    <td colSpan={cols.length} className="px-2.5 py-1.5 font-semibold">
                      {g.title}{g.subtitle && <span className="font-normal text-white/80 ml-2">{g.subtitle}</span>}
                    </td>
                  </tr>
                )}
                {g.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/70 align-top">
                    {cols.map((c) => (
                      <td key={c.key} className={`px-2.5 py-1.5 ${numeric(c) || ["time", "date", "datetime", "text"].includes(c.kind) ? "whitespace-nowrap" : ""} ${numeric(c) ? "text-right" : ""} ${c.weekend ? "bg-[#fdf1ed]" : ""}`}>
                        {cell(c, r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {g.totals && <tr className="border-t border-line bg-asphalt/40">{totalLabel(g.totals, "Totale")}</tr>}
              </tbody>
            ))}
            {result.totals && (
              <tfoot>
                <tr className="border-t-2 border-ink/40 bg-asphalt/70">{totalLabel(result.totals, "Totale generale")}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}

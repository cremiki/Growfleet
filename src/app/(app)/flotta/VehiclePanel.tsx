"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TelemetryEntry, VehicleState } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { ago, fmt1, fmtDateTime, fmtInt, STATUS_COLOR } from "@/lib/format";

type Props = { vehicle: VehicleState; customerName?: string; onBack: () => void };

export function VehiclePanel({ vehicle: v, customerName, onBack }: Props) {
  const dark = v.status !== "idle" && v.status !== "nodata";
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pt-3">
        <button type="button" onClick={onBack} className="text-sign font-medium text-sm hover:underline">
          ‹ Tutti i veicoli
        </button>
      </div>
      <header className="px-4 pt-3 pb-4">
        <h2 className="plate text-[28px] font-bold leading-tight">{v.name}</h2>
        <p className="text-sm text-muted mt-1">
          {v.ident ? `IMEI ${v.ident}` : `Dispositivo ${v.id}`}
          {customerName ? `, ${customerName}` : ""}
        </p>
      </header>

      {/* Il "cartello" di stato: l'elemento che si legge per primo */}
      <div className="mx-4 rounded-md px-4 py-3 border-2 border-white outline outline-1 outline-line"
        style={{ background: STATUS_COLOR[v.status], color: dark ? "#fff" : "#18212b" }}>
        <p className="plate text-2xl font-bold leading-tight">
          {STATUS_LABEL[v.status]}{v.status === "moving" && v.speed != null ? `, ${fmtInt(v.speed)} km/h` : ""}
        </p>
        <p className="text-sm mt-0.5 opacity-90">Ultimo dato {ago(v.lastSeen)}{v.lastSeen ? ` (${fmtDateTime(v.lastSeen)})` : ""}</p>
      </div>

      <dl className="grid grid-cols-2 mx-4 mt-4 border-t border-l border-line">
        <Metric label="Quadro" value={v.ignition == null ? "—" : v.ignition ? "Acceso" : "Spento"} />
        <Metric label="Velocità" value={v.speed == null ? "—" : `${fmtInt(v.speed)} km/h`} />
        <Metric label="Carburante" value={v.fuelLevel != null ? `${fmtInt(v.fuelLevel)}%` : v.fuelVolume != null ? `${fmtInt(v.fuelVolume)} l` : "—"}
          extra={v.fuelLevel != null ? <FuelBar pct={v.fuelLevel} /> : undefined}
          sub={v.fuelLevel != null && v.fuelVolume != null ? `${fmtInt(v.fuelVolume)} litri` : undefined} />
        <Metric label="Contachilometri" value={v.odometerKm == null ? "—" : `${fmtInt(v.odometerKm)} km`} />
        <Metric label="Ore motore" value={v.engineHours == null ? "—" : `${fmtInt(v.engineHours)} h`} />
        <Metric label="Alimentazione" value={v.externalV == null ? "—" : `${fmt1(v.externalV)} V`}
          sub={v.batteryV != null ? `Batteria interna ${fmt1(v.batteryV)} V` : undefined} />
        <Metric label="Satelliti" value={v.satellites == null ? "—" : fmtInt(v.satellites)} />
        <Metric label="Posizione" value={v.lat == null ? "—" : `${v.lat.toFixed(5)}, ${v.lon!.toFixed(5)}`} small />
      </dl>

      <div className="mx-4 mt-4 flex gap-2">
        <Link href={`/flotta/${v.id}/storico`}
          className="flex-1 text-center bg-sign hover:bg-sign-dark text-white font-semibold rounded-md py-2.5">
          Storico percorsi
        </Link>
        {v.lat != null && (
          <a href={`https://www.google.com/maps?q=${v.lat},${v.lon}`} target="_blank" rel="noreferrer"
            className="px-4 text-center border border-line rounded-md py-2.5 font-medium hover:bg-asphalt">
            Apri in Google Maps
          </a>
        )}
      </div>

      <AllParams id={v.id} tick={v.lastSeen} />
    </div>
  );
}

function Metric({ label, value, sub, extra, small }: { label: string; value: string; sub?: string; extra?: React.ReactNode; small?: boolean }) {
  return (
    <div className="border-r border-b border-line px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`plate font-semibold mt-0.5 ${small ? "text-[15px]" : "text-xl"}`}>{value}</dd>
      {extra}
      {sub && <dd className="text-xs text-muted mt-0.5">{sub}</dd>}
    </div>
  );
}

function FuelBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const color = p < 15 ? "var(--color-offline)" : p < 30 ? "var(--color-idle)" : "var(--color-moving)";
  return (
    <dd className="h-1.5 bg-asphalt rounded-full mt-1.5 overflow-hidden" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
    </dd>
  );
}

function AllParams({ id, tick }: { id: number; tick: number | null }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TelemetryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/vehicles/${id}`, { cache: "no-store" })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b; })
      .then((b) => { if (alive) { setRows(b.telemetry); setError(null); } })
      .catch((e) => alive && setError(e.message || "Impossibile caricare i parametri."));
    return () => { alive = false; };
  }, [open, id, tick]);

  return (
    <section className="mx-4 my-5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex justify-between items-center font-semibold py-2 border-b border-line">
        <span>Tutti i parametri del dispositivo</span>
        <span className="text-muted text-sm">{open ? "Nascondi" : "Mostra"}</span>
      </button>
      {open && (
        error ? <p className="text-offline text-sm mt-2">{error}</p> :
        !rows ? <p className="text-muted text-sm mt-2">Caricamento…</p> :
        <table className="w-full text-sm mt-1">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-line/70 align-top">
                <td className="py-1.5 pr-2 text-muted break-all">{r.name}</td>
                <td className="py-1.5 text-right font-medium break-all">{formatValue(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(5).replace(/0+$/, "");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "—");
}

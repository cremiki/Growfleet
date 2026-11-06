"use client";

import type { VehicleState } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { ago, fmtDateTime, fmtInt, STATUS_COLOR } from "@/lib/format";
import { StatusIcon } from "./StatusIcon";

/** Scheda espansa dell'elenco veicoli */
export function VehicleCard({ v, address, customerName, onOpen }: {
  v: VehicleState; address?: string; customerName?: string; onOpen: () => void;
}) {
  const stale = v.status === "offline";
  return (
    <button type="button" onClick={onOpen} className="w-full text-left block border-b border-line px-3 py-2.5 hover:bg-asphalt/50 focus-visible:bg-asphalt/50">
      <span className="flex items-center gap-2">
        <StatusIcon status={v.status} course={v.course} />
        <span className="plate font-bold text-[17px] truncate flex-1">{v.name}</span>
        <span className={`text-xs ${stale ? "text-offline font-semibold" : "text-muted"}`}>{ago(v.lastSeen)}</span>
        <span className="text-[11px] border border-line rounded px-1 text-muted whitespace-nowrap">{fmtInt(v.speed ?? 0)} km/h</span>
      </span>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
        <dt className="text-muted">Stato</dt>
        <dd className="text-right font-medium" style={{ color: STATUS_COLOR[v.status] }}>{STATUS_LABEL[v.status]}</dd>
        {customerName && (<><dt className="text-muted">Cliente</dt><dd className="text-right">{customerName}</dd></>)}
        {v.lat != null && (
          <>
            <dt className="text-muted">Indirizzo</dt>
            <dd className="text-right">{address ?? <span className="text-muted">ricerca indirizzo…</span>}</dd>
            <dt className="text-muted">Coordinate</dt>
            <dd className="text-right">{v.lat.toFixed(5)}, {v.lon!.toFixed(5)}</dd>
          </>
        )}
        {v.odometerKm != null && (<><dt className="text-muted">Contachilometri</dt><dd className="text-right">{fmtInt(v.odometerKm)} km</dd></>)}
        {v.fuelLevel != null && (<><dt className="text-muted">Carburante</dt><dd className="text-right">{fmtInt(v.fuelLevel)}%{v.fuelVolume != null ? ` (${fmtInt(v.fuelVolume)} l)` : ""}</dd></>)}
        <dt className="text-muted">Ultimi dati ricevuti</dt>
        <dd className="text-right">{v.lastSeen ? fmtDateTime(v.lastSeen) : "mai"}</dd>
      </dl>
    </button>
  );
}

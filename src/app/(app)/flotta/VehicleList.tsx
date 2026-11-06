"use client";

import type { VehicleState } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { ago, fmtInt, STATUS_COLOR } from "@/lib/format";

type Props = {
  vehicles: VehicleState[];
  total: number;
  loading: boolean;
  onSelect: (id: number) => void;
  customerName?: (cid: number | null) => string | undefined;
};

export function VehicleList({ vehicles, total, loading, onSelect, customerName }: Props) {
  if (loading) {
    return (
      <ul className="flex-1 overflow-hidden" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-[72px] border-b border-line px-4 py-3">
            <div className="h-4 w-40 bg-asphalt rounded" /><div className="h-3 w-24 bg-asphalt rounded mt-2" />
          </li>
        ))}
      </ul>
    );
  }
  if (total === 0) {
    return (
      <div className="flex-1 p-6 text-muted leading-relaxed">
        <p className="font-semibold text-ink">Nessun veicolo collegato</p>
        <p className="mt-1">I veicoli compaiono qui appena il dispositivo è registrato in flespi e assegnato a questo account.</p>
      </div>
    );
  }
  if (vehicles.length === 0) {
    return <p className="flex-1 p-6 text-muted">Nessun veicolo corrisponde ai filtri.</p>;
  }
  return (
    <ul className="flex-1 overflow-y-auto">
      {vehicles.map((v) => (
        <li key={v.id}>
          <button type="button" onClick={() => onSelect(v.id)}
            className="w-full text-left flex items-stretch border-b border-line hover:bg-asphalt/50 focus-visible:bg-asphalt/50">
            <span className="w-1.5 shrink-0" style={{ background: STATUS_COLOR[v.status] }} aria-hidden />
            <span className="flex-1 min-w-0 px-4 py-3">
              <span className="plate block text-[19px] font-semibold leading-tight truncate">{v.name}</span>
              <span className="block text-sm text-muted mt-0.5 truncate">
                {STATUS_LABEL[v.status]}
                {customerName && customerName(v.cid) ? <span className="text-muted/80">, {customerName(v.cid)}</span> : null}
              </span>
            </span>
            <span className="shrink-0 px-4 py-3 text-right">
              {v.status === "moving" ? (
                <span className="plate text-[19px] font-semibold leading-tight">{fmtInt(v.speed)}<span className="text-sm font-normal text-muted"> km/h</span></span>
              ) : (
                <span className="text-sm text-muted">{ago(v.lastSeen)}</span>
              )}
              {v.fuelLevel != null && <span className="block text-xs text-muted mt-1">Carburante {fmtInt(v.fuelLevel)}%</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

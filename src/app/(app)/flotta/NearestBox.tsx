"use client";

import type { VehicleState } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { fmt1, haversineKm, STATUS_COLOR } from "@/lib/format";
import { StatusIcon } from "./StatusIcon";

type Place = { lat: number; lon: number; label: string };

/** Veicoli più vicini all'indirizzo cercato, in linea d'aria */
export function NearestBox({ place, vehicles, onSelect, onClose }: {
  place: Place; vehicles: VehicleState[]; onSelect: (id: number) => void; onClose: () => void;
}) {
  const near = vehicles
    .filter((v) => v.lat != null && v.lon != null)
    .map((v) => ({ v, km: haversineKm([place.lat, place.lon], [v.lat!, v.lon!]) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);

  return (
    <div className="w-80 bg-white border border-line rounded shadow-lg">
      <div className="flex items-start gap-2 px-3 py-2 border-b border-line">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Veicoli più vicini</p>
          <p className="text-xs text-muted truncate" title={place.label}>a {place.label}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="text-muted hover:text-ink text-lg leading-none px-1">×</button>
      </div>
      {near.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted">Nessun veicolo con posizione.</p>
      ) : (
        <ol>
          {near.map(({ v, km }, i) => (
            <li key={v.id}>
              <button type="button" onClick={() => onSelect(v.id)} className="w-full text-left flex items-center gap-2.5 px-3 py-2 border-b border-line/60 last:border-0 hover:bg-asphalt/50">
                <span className="text-xs text-muted w-3">{i + 1}</span>
                <StatusIcon status={v.status} course={v.course} type={v.vtype} size={20} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{v.name}</span>
                  <span className="block text-xs truncate" style={{ color: STATUS_COLOR[v.status] }}>
                    {STATUS_LABEL[v.status]}{v.driver ? <span className="text-muted">, {v.driver}</span> : null}
                  </span>
                </span>
                <span className="plate text-sm font-semibold whitespace-nowrap">{km < 1 ? `${Math.round(km * 1000)} m` : `${fmt1(km)} km`}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="px-3 py-1.5 text-[11px] text-muted border-t border-line">Distanza in linea d&apos;aria.</p>
    </div>
  );
}

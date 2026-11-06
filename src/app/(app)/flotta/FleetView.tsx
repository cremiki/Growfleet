"use client";

import { useEffect, useMemo, useState } from "react";
import { FleetMap, MapSwitch, useMapProvider } from "@/components/map";
import { useVehicles } from "@/lib/useVehicles";
import type { VehicleState, VehicleStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/format";
import { VehicleList } from "./VehicleList";
import { VehiclePanel } from "./VehiclePanel";

type Props = { isAdmin: boolean; customers: { id: number; name: string; deviceIds: number[] }[] };

export function FleetView({ isAdmin, customers }: Props) {
  const [customerId, setCustomerId] = useState<number | null>(null);
  const { vehicles, error, updatedAt } = useVehicles(customerId);
  const [provider, setProvider] = useMapProvider();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | null>(null);

  // Selezione sincronizzata con l'URL (?v=ID), così il link si può condividere
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get("v"));
    if (v) setSelectedId(v);
  }, []);
  const select = (id: number | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("v", String(id)); else url.searchParams.delete("v");
    window.history.replaceState(null, "", url);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (vehicles ?? []).filter((v) =>
      (!statusFilter || v.status === statusFilter) &&
      (!q || v.name.toLowerCase().includes(q) || v.ident.includes(q)));
  }, [vehicles, query, statusFilter]);

  const selected: VehicleState | undefined = vehicles?.find((v) => v.id === selectedId);
  const customerName = (deviceId: number) => customers.filter((c) => c.deviceIds.includes(deviceId)).map((c) => c.name).join(", ") || undefined;

  return (
    <div className="h-full flex flex-col-reverse md:grid md:grid-cols-[minmax(340px,400px)_1fr]">
      <aside className="flex-1 md:flex-none min-h-0 bg-surface border-r border-line flex flex-col">
        {selected ? (
          <VehiclePanel vehicle={selected} customerName={isAdmin ? customerName(selected.id) : undefined} onBack={() => select(null)} />
        ) : (
          <>
            <div className="p-4 space-y-3 border-b border-line">
              {isAdmin && customers.length > 0 && (
                <label className="block">
                  <span className="sr-only">Cliente</span>
                  <select value={customerId ?? ""} onChange={(e) => { setCustomerId(e.target.value ? Number(e.target.value) : null); select(null); }}
                    className="w-full border border-line rounded-md px-3 py-2 bg-white">
                    <option value="">Tutti i clienti</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per targa, nome o IMEI"
                className="w-full border border-line rounded-md px-3 py-2 bg-white" aria-label="Cerca veicolo" />
              <StatusFilter vehicles={vehicles ?? []} value={statusFilter} onChange={setStatusFilter} />
            </div>
            <VehicleList vehicles={filtered} loading={!vehicles && !error} total={vehicles?.length ?? 0}
              onSelect={select} customerName={isAdmin && !customerId ? customerName : undefined} />
          </>
        )}
        <footer className="px-4 py-2 border-t border-line text-xs text-muted flex justify-between">
          <span>{error ? <span className="text-offline">{error}</span> : updatedAt ? `Aggiornato alle ${new Date(updatedAt).toLocaleTimeString("it-IT")}` : "Caricamento…"}</span>
          <span>{vehicles ? `${vehicles.length} veicoli` : ""}</span>
        </footer>
      </aside>
      <section className="relative h-[45vh] md:h-auto min-h-0">
        <FleetMap provider={provider} vehicles={filtered} selectedId={selectedId} onSelect={select} />
        <div className="absolute top-3 right-3 z-[1000]">
          <MapSwitch value={provider} onChange={setProvider} />
        </div>
      </section>
    </div>
  );
}

const ORDER: VehicleStatus[] = ["moving", "idle", "stopped", "offline"];
const SHORT: Record<VehicleStatus, string> = { moving: "In marcia", idle: "Fermi accesi", stopped: "Spenti", offline: "Non raggiungibili", nodata: "Senza posizione" };

function StatusFilter({ vehicles, value, onChange }: { vehicles: VehicleState[]; value: VehicleStatus | null; onChange: (s: VehicleStatus | null) => void }) {
  const counts = vehicles.reduce<Record<string, number>>((a, v) => ((a[v.status] = (a[v.status] ?? 0) + 1), a), {});
  const statuses = [...ORDER, ...(counts.nodata ? (["nodata"] as const) : [])];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per stato">
      {statuses.map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? null : s)} aria-pressed={value === s}
          title={STATUS_LABEL[s]}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${value === s ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-muted"}`}>
          <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
          <span>{SHORT[s]}</span>
          <span className="font-semibold">{counts[s] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

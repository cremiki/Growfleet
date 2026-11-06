"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveMap, MapSwitch, useMapProvider, type Focus, type RouteOverlay } from "@/components/map";
import { useVehicles } from "@/lib/useVehicles";
import { useAddresses } from "@/lib/useAddresses";
import type { VehicleStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/format";
import { VehicleCard } from "./VehicleCard";
import { VehiclePanel } from "./VehiclePanel";
import { Dropdown } from "./Dropdown";
import { AddressSearch } from "./AddressSearch";
import { NearestBox } from "./NearestBox";

type Customer = { id: number; name: string; deviceIds: number[] };
type Props = { isAdmin: boolean; customers: Customer[] };
type Sort = "name" | "recent" | "status";

const STATUS_ORDER: VehicleStatus[] = ["moving", "idle", "stopped", "offline", "nodata"];

export function FleetView({ isAdmin, customers }: Props) {
  const { vehicles, error, updatedAt } = useVehicles(null);
  const [provider, setProvider] = useMapProvider();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<"now" | "routes">("now");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<VehicleStatus[]>([]);
  const [sort, setSort] = useState<Sort>("name");
  const [route, setRoute] = useState<RouteOverlay | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [fitAllKey, setFitAllKey] = useState(0);
  const [near, setNear] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selezione e scheda sincronizzate con l'URL (?v=ID&tab=itinerari), così il link si può condividere
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = Number(sp.get("v"));
    if (v) setSelectedId(v);
    if (sp.get("tab") === "itinerari") setTab("routes");
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("v", String(selectedId)); else url.searchParams.delete("v");
    if (selectedId && tab === "routes") url.searchParams.set("tab", "itinerari"); else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }, [selectedId, tab]);

  const select = (id: number | null) => {
    setSelectedId(id);
    setRoute(null);
    if (id === null) setTab("now");
  };

  const inGroups = useMemo(() => {
    if (!groups.length) return null;
    return new Set(customers.filter((c) => groups.includes(c.id)).flatMap((c) => c.deviceIds));
  }, [groups, customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (vehicles ?? []).filter((v) =>
      (!statuses.length || statuses.includes(v.status)) &&
      (!inGroups || inGroups.has(v.id)) &&
      (!q || v.name.toLowerCase().includes(q) || v.ident.includes(q)));
    const by = {
      name: (a: typeof list[0], b: typeof list[0]) => a.name.localeCompare(b.name, "it"),
      recent: (a: typeof list[0], b: typeof list[0]) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0),
      status: (a: typeof list[0], b: typeof list[0]) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "it"),
    }[sort];
    return [...list].sort(by);
  }, [vehicles, query, statuses, inGroups, sort]);

  const address = useAddresses(filtered);
  const selected = vehicles?.find((v) => v.id === selectedId);
  const customerOf = (id: number) => customers.filter((c) => c.deviceIds.includes(id)).map((c) => c.name).join(", ") || undefined;
  const counts = (vehicles ?? []).reduce<Record<string, number>>((a, v) => ((a[v.status] = (a[v.status] ?? 0) + 1), a), {});

  return (
    <div className="h-full flex flex-col">
      {/* barra filtri */}
      <div className="bg-surface border-b border-line px-3 py-2 flex flex-wrap items-center gap-2">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Ricerca veicoli" aria-label="Ricerca veicoli"
          className="w-72 max-w-full border border-line rounded px-3 py-1.5 bg-white text-[15px]" />
        {isAdmin && customers.length > 0 && (
          <Dropdown label="Gruppi" selected={groups} onChange={(x) => setGroups(x as number[])}
            options={customers.map((c) => ({ value: c.id, label: c.name }))} />
        )}
        <Dropdown label="Stato" selected={statuses} onChange={(x) => setStatuses(x as VehicleStatus[])}
          options={STATUS_ORDER.filter((s) => s !== "nodata" || counts.nodata).map((s) => ({
            value: s, label: `${STATUS_LABEL[s]} (${counts[s] ?? 0})`, color: STATUS_COLOR[s],
          }))} />
        <span className="ml-auto text-xs text-muted">
          {error ? <span className="text-offline">{error}</span> : updatedAt ? `Aggiornato alle ${new Date(updatedAt).toLocaleTimeString("it-IT")}` : "Caricamento…"}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col-reverse md:grid md:grid-cols-[360px_1fr]">
        <aside className="flex-1 md:flex-none min-h-0 bg-surface border-r border-line flex flex-col">
          {selected ? (
            <VehiclePanel key={selected.id} vehicle={selected} tab={tab} onTab={setTab} customerName={isAdmin ? customerOf(selected.id) : undefined}
              onBack={() => select(null)} onRoute={setRoute} onFocus={setFocus} />
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-line text-sm">
                <span className="font-semibold">
                  {filtered.length === (vehicles?.length ?? 0) ? "Tutti i veicoli" : "Veicoli filtrati"} ({filtered.length})
                </span>
                <label className="flex items-center gap-1.5 text-muted">
                  Ordina
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="border border-line rounded px-1.5 py-0.5 bg-white text-ink">
                    <option value="name">per nome</option>
                    <option value="recent">per ultimo dato</option>
                    <option value="status">per stato</option>
                  </select>
                </label>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto">
                {!vehicles && !error && <p className="p-4 text-muted">Caricamento dei veicoli…</p>}
                {vehicles && vehicles.length === 0 && (
                  <div className="p-5 text-muted leading-relaxed">
                    <p className="font-semibold text-ink">Nessun veicolo</p>
                    <p className="mt-1">{isAdmin ? "Il token flespi non vede dispositivi: controlla la pagina Collegamento flespi." : "Non ci sono ancora veicoli assegnati al tuo account."}</p>
                  </div>
                )}
                {vehicles && vehicles.length > 0 && filtered.length === 0 && <p className="p-4 text-muted">Nessun veicolo corrisponde ai filtri.</p>}
                {filtered.map((v) => (
                  <VehicleCard key={v.id} v={v} address={address(v.lat, v.lon)} customerName={isAdmin && !groups.length ? customerOf(v.id) : undefined}
                    onOpen={() => select(v.id)} />
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="relative h-[45vh] md:h-auto min-h-0">
          <LiveMap provider={provider} vehicles={selected ? [selected] : filtered} selectedId={selectedId}
            onSelect={(id) => select(id)} route={route} focus={focus} fitAllKey={fitAllKey} pin={near} />
          <div className="absolute top-2.5 left-14 z-[1000] space-y-2">
            <AddressSearch placeholder="Cerca un indirizzo per trovare i veicoli vicini"
              onPick={(r) => { setNear(r); setFocus({ lat: r.lat, lon: r.lon, zoom: 12, key: `${r.lat},${r.lon},${Date.now()}` }); }} />
            {near && (
              <NearestBox place={near} vehicles={vehicles ?? []} onClose={() => setNear(null)}
                onSelect={(id) => select(id)} />
            )}
          </div>
          <div className="absolute top-2.5 right-2.5 z-[1000]">
            <MapSwitch value={provider} onChange={setProvider} />
          </div>
          <button type="button" onClick={() => { if (selected) select(null); setFitAllKey((k) => k + 1); }}
            className="absolute bottom-6 left-3 z-[1000] bg-ink/80 hover:bg-ink text-white text-sm font-semibold rounded px-3 py-1.5">
            Mostra tutti
          </button>
        </section>
      </div>
    </div>
  );
}

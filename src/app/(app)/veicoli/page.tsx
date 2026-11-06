import Link from "next/link";
import { Suspense } from "react";
import { inArray } from "drizzle-orm";
import { canEdit, requireSession, scopeFor, type Scope } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import { monthStats, type MonthStats } from "@/lib/vehicleStats";
import { reminderState } from "@/lib/reminders";
import { fmt1, fmtInt } from "@/lib/format";
import type { VehicleState } from "@/lib/types";
import { StatusIcon } from "../flotta/StatusIcon";
import { Tile } from "./Tile";

export const dynamic = "force-dynamic";

export default async function FleetListPage() {
  const s = await requireSession();
  const scope = await scopeFor(s);
  const vehicles = await fleet.listVehicles(scope);
  const db = await getDb();
  const ids = vehicles.map((v) => v.id);
  const [profiles, rems] = ids.length
    ? await Promise.all([
      db.select().from(schema.vehicles).where(inArray(schema.vehicles.deviceId, ids)),
      db.select().from(schema.reminders).where(inArray(schema.reminders.deviceId, ids)),
    ])
    : [[], []];
  const prof = new Map(profiles.map((p) => [p.deviceId, p]));

  const due = (kind: string) => {
    let soon = 0, overdue = 0, open = 0;
    for (const r of rems.filter((x) => x.kind === kind && !x.doneAt)) {
      const v = vehicles.find((x) => x.id === r.deviceId);
      const st = reminderState(r, v?.odometerKm ?? null, v?.engineHours ?? null).status;
      open++; if (st === "soon") soon++; if (st === "overdue") overdue++;
    }
    return { open, soon, overdue };
  };
  const maint = due("manutenzione");
  const docs = due("documento");
  const remsOf = (id: number) => rems.filter((r) => r.deviceId === id && !r.doneAt)
    .map((r) => reminderState(r, vehicles.find((x) => x.id === id)?.odometerKm ?? null, vehicles.find((x) => x.id === id)?.engineHours ?? null).status);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <h1 className="text-2xl font-semibold">Flotta</h1>
        <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <Tile title="Promemoria di manutenzione" value={String(maint.open)} sub={dueText(maint)} tone={maint.overdue ? "bad" : maint.soon ? "warn" : undefined} />
          <Tile title="Documenti e scadenze" value={String(docs.open)} sub={dueText(docs)} tone={docs.overdue ? "bad" : docs.soon ? "warn" : undefined} />
          <Suspense fallback={<Tile title="Distanza percorsa questo mese" value="…" sub="Calcolo in corso" />}>
            <MonthTiles scope={scope} vehicles={vehicles} />
          </Suspense>
        </div>

        <div className="mt-6 bg-surface border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-asphalt/60 text-left">
              <tr>
                {["Tipo", "Targa / nome", "Marca e modello", "Anno", "Contachilometri", "Ore motore", "Carburante", "Serbatoio", "Consumo medio", "Autista", "IMEI", "Scadenze"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-6 text-muted">Nessun veicolo visibile.</td></tr>
              )}
              {vehicles.map((v) => {
                const p = prof.get(v.id);
                const st = remsOf(v.id);
                return (
                  <tr key={v.id} className="border-t border-line/70 hover:bg-asphalt/40">
                    <td className="px-3 py-2"><StatusIcon status={v.status} course={v.course} type={v.vtype} size={22} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/veicoli/${v.id}`} className="text-sign font-semibold hover:underline">{v.name}</Link>
                      {v.unavailable && <span className="ml-2 text-xs text-offline font-semibold">Non disponibile</span>}
                      {v.plate && v.deviceName !== v.plate && <span className="block text-xs text-muted">{v.deviceName}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{v.makeModel ?? "—"}</td>
                    <td className="px-3 py-2">{p?.year ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{v.odometerKm != null ? `${fmtInt(v.odometerKm)} km` : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{v.engineHours != null ? `${fmtInt(v.engineHours)} h` : "—"}</td>
                    <td className="px-3 py-2">{p?.fuelType ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{p?.tankL != null ? `${fmtInt(p.tankL)} l` : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{p?.consumptionL100 != null ? `${fmt1(p.consumptionL100)} l/100km` : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v.driver ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{v.ident || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {st.length === 0 ? <span className="text-muted">—</span>
                        : st.includes("overdue") ? <span className="text-offline font-semibold">{st.filter((x) => x === "overdue").length} scadute</span>
                        : st.includes("soon") ? <span className="text-idle font-semibold">{st.filter((x) => x === "soon").length} in scadenza</span>
                        : <span className="text-moving">{st.length} in regola</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(await canEdit(s)) && <p className="text-sm text-muted mt-3">Apri un veicolo per completarne l&apos;anagrafica: targa, modello e tipo vengono usati in mappa e nei report.</p>}
      </div>
    </div>
  );
}

function dueText(d: { soon: number; overdue: number }) {
  if (!d.soon && !d.overdue) return "Nessuna scadenza vicina";
  return [d.overdue ? `${d.overdue} scaduti` : null, d.soon ? `${d.soon} in scadenza a breve` : null].filter(Boolean).join(", ");
}

async function MonthTiles({ scope, vehicles }: { scope: Scope; vehicles: VehicleState[] }) {
  const stats: (MonthStats | null)[] = [];
  for (let i = 0; i < vehicles.length; i += 4) {
    stats.push(...(await Promise.all(vehicles.slice(i, i + 4).map((v) => monthStats(scope, v).catch(() => null)))));
  }
  const total = (k: "km" | "hours" | "fuel", m: "thisMonth" | "lastMonth") => {
    const vals = stats.map((s) => s?.[m][k]).filter((x): x is number => x != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const counted = stats.filter((s) => s?.thisMonth.km != null).length;
  const t = (v: number | null, f: (n: number) => string) => (v == null ? "—" : f(v));
  return (
    <>
      <Tile title="Distanza percorsa questo mese" value={t(total("km", "thisMonth"), (n) => `${fmt1(n)} km`)}
        sub={`${t(total("km", "lastMonth"), (n) => `${fmt1(n)} km`)} il mese scorso${counted < vehicles.length ? `, su ${counted} veicoli con contachilometri` : ""}`} />
      <Tile title="Ore motore questo mese" value={t(total("hours", "thisMonth"), (n) => `${fmt1(n)} h`)} sub={`${t(total("hours", "lastMonth"), (n) => `${fmt1(n)} h`)} il mese scorso`} />
      <Tile title="Carburante consumato questo mese" value={t(total("fuel", "thisMonth"), (n) => `${fmtInt(n)} l`)} sub={`${t(total("fuel", "lastMonth"), (n) => `${fmtInt(n)} l`)} il mese scorso`} />
      <Tile title="Veicoli" value={String(vehicles.length)} sub={`${vehicles.filter((v) => v.status === "moving").length} in marcia, ${vehicles.filter((v) => v.status === "offline").length} non raggiungibili`} />
    </>
  );
}

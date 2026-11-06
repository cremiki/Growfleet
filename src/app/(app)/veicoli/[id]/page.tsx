import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { requireSession, scopeFor, type Scope } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import { monthStats } from "@/lib/vehicleStats";
import { reminderState } from "@/lib/reminders";
import { ago, fmt1, fmtInt, STATUS_COLOR } from "@/lib/format";
import { STATUS_LABEL, type VehicleState } from "@/lib/types";
import { StatusIcon } from "../../flotta/StatusIcon";
import { Tile } from "../Tile";
import { AddressText } from "./AddressText";
import { ProfileTabs } from "./ProfileTabs";

export const dynamic = "force-dynamic";

export default async function VehicleProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await requireSession();
  const scope = await scopeFor(s);
  const detail = Number.isInteger(id) ? await fleet.getVehicle(scope, id) : null;
  if (!detail) notFound();
  const v = detail.state;
  const db = await getDb();
  const [[profile], rems] = await Promise.all([
    db.select().from(schema.vehicles).where(eq(schema.vehicles.deviceId, id)),
    db.select().from(schema.reminders).where(eq(schema.reminders.deviceId, id)).orderBy(asc(schema.reminders.createdAt)),
  ]);
  const states = rems.map((r) => ({ ...r, ...reminderState(r, v.odometerKm, v.engineHours) }));
  const count = (kind: string) => {
    const open = states.filter((r) => r.kind === kind && r.status !== "done");
    return { open: open.length, soon: open.filter((r) => r.status === "soon").length, overdue: open.filter((r) => r.status === "overdue").length };
  };
  const maint = count("manutenzione");
  const docs = count("documento");
  const isAdmin = s.role === "admin";

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-6xl">
        <div className="flex items-center justify-between">
          <Link href="/veicoli" className="text-sign text-sm font-medium hover:underline">‹ Torna alla flotta</Link>
          <div className="flex gap-2">
            <Link href={`/flotta?v=${id}`} className="border border-line bg-white rounded px-3 py-1.5 text-sm hover:bg-asphalt">Vedi sulla mappa</Link>
            {isAdmin && <Link href={`/veicoli/${id}/modifica`} className="bg-sign hover:bg-sign-dark text-white rounded px-3 py-1.5 text-sm font-semibold">Modifica veicolo</Link>}
          </div>
        </div>

        <section className="mt-4 bg-surface border border-line p-5 flex flex-wrap gap-6">
          <div className="flex items-start gap-3 min-w-0">
            <StatusIcon status={v.status} course={v.course} type={v.vtype} size={40} />
            <div>
              <h1 className="plate text-3xl font-bold leading-tight">{v.name} {v.makeModel && <span className="font-semibold text-muted">{v.makeModel}</span>}</h1>
              {v.deviceName && v.deviceName !== v.name && <p className="text-sm text-muted">Dispositivo flespi: {v.deviceName}{v.ident ? `, IMEI ${v.ident}` : ""}</p>}
              {v.unavailable && <p className="text-sm text-offline font-semibold mt-1">Segnato come non disponibile</p>}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[15px] min-w-[320px]">
            <dt className="text-muted">Autista</dt><dd>{v.driver ?? "—"}</dd>
            <dt className="text-muted">Posizione</dt><dd>{v.lat != null ? <AddressText lat={v.lat} lon={v.lon!} /> : "—"}</dd>
            <dt className="text-muted">Stato attuale</dt>
            <dd><span style={{ color: STATUS_COLOR[v.status] }} className="font-medium">{STATUS_LABEL[v.status]}</span> <span className="text-muted">(ultimi dati {ago(v.lastSeen)})</span></dd>
            <dt className="text-muted">Carburante</dt>
            <dd>{v.fuelLevel != null ? `${fmtInt(v.fuelLevel)}%` : ""}{v.fuelVolume != null ? ` ${fmt1(v.fuelVolume)} l` : ""}{v.fuelLevel == null && v.fuelVolume == null ? "—" : ""}</dd>
            <dt className="text-muted">Contachilometri</dt><dd>{v.odometerKm != null ? `${fmt1(v.odometerKm)} km` : "—"}</dd>
            <dt className="text-muted">Ore motore</dt><dd>{v.engineHours != null ? `${fmt1(v.engineHours)} h` : "—"}</dd>
          </dl>
        </section>

        <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <Tile title="Promemoria di manutenzione" value={String(maint.open)} sub={maint.overdue ? `${maint.overdue} scaduti` : maint.soon ? `${maint.soon} in scadenza a breve` : "Nessuna scadenza vicina"} tone={maint.overdue ? "bad" : maint.soon ? "warn" : undefined} />
          <Tile title="Documenti e scadenze" value={String(docs.open)} sub={docs.overdue ? `${docs.overdue} scaduti` : docs.soon ? `${docs.soon} in scadenza a breve` : "Nessuna scadenza vicina"} tone={docs.overdue ? "bad" : docs.soon ? "warn" : undefined} />
          <Suspense fallback={<Tile title="Distanza percorsa questo mese" value="…" sub="Calcolo in corso" />}>
            <MonthTiles scope={scope} v={v} />
          </Suspense>
        </div>

        <ProfileTabs
          deviceId={id}
          isAdmin={isAdmin}
          profile={profile ?? null}
          reminders={states.map((r) => ({ id: r.id, kind: r.kind, title: r.title, dueDate: r.dueDate, dueKm: r.dueKm, dueHours: r.dueHours, notes: r.notes, done: !!r.doneAt, status: r.status, daysLeft: r.daysLeft, kmLeft: r.kmLeft, hoursLeft: r.hoursLeft }))}
          odometer={v.odometerKm}
          hours={v.engineHours}
        />
      </div>
    </div>
  );
}

async function MonthTiles({ scope, v }: { scope: Scope; v: VehicleState }) {
  const m = await monthStats(scope, v).catch(() => null);
  const t = (x: number | null | undefined, f: (n: number) => string) => (x == null ? "—" : f(x));
  return (
    <>
      <Tile title="Distanza percorsa questo mese" value={t(m?.thisMonth.km, (n) => `${fmt1(n)} km`)} sub={`${t(m?.lastMonth.km, (n) => `${fmt1(n)} km`)} il mese scorso`} />
      <Tile title="Ore motore questo mese" value={t(m?.thisMonth.hours, (n) => `${fmt1(n)} h`)} sub={`${t(m?.lastMonth.hours, (n) => `${fmt1(n)} h`)} il mese scorso`} />
      <Tile title="Carburante consumato questo mese" value={t(m?.thisMonth.fuel, (n) => `${fmtInt(n)} l`)} sub={`${t(m?.lastMonth.fuel, (n) => `${fmtInt(n)} l`)} il mese scorso`} />
      {m && m.thisMonth.km == null && m.thisMonth.hours == null && m.thisMonth.fuel == null && (
        <p className="sm:col-span-2 xl:col-span-3 text-xs text-muted">Il dispositivo non invia contachilometri, ore motore o carburante consumato: i totali del mese sono nel Rapporto mensile (km), calcolato dal GPS.</p>
      )}
    </>
  );
}

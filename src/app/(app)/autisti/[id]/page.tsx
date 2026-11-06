import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { canEdit, ownsDriver, requireSession, scopeFor } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import { AssignForm, EditDriverForm } from "../DriverForms";
import { deleteDriver } from "../actions";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });

export default async function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession();
  const id = Number((await params).id);
  const db = await getDb();
  const [[d], customers, history, [veh]] = await Promise.all([
    Number.isInteger(id) ? db.select().from(schema.drivers).where(eq(schema.drivers.id, id)) : Promise.resolve([]),
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select().from(schema.driverAssignments).where(eq(schema.driverAssignments.driverId, id)).orderBy(desc(schema.driverAssignments.startAt)).limit(50),
    db.select({ deviceId: schema.vehicles.deviceId }).from(schema.vehicles).where(eq(schema.vehicles.driverId, id)),
  ]);
  if (!d) notFound();
  const isAdmin = s.role === "admin";
  const editable = (await canEdit(s)) && ownsDriver(s, d); // il team, o il cliente proprietario dell'autista
  const vehicles = await fleet.listVehicles(await scopeFor(s));
  // un cliente vede solo i propri autisti o quelli dei suoi veicoli
  if (!isAdmin && d.customerId !== s.customerId && !(veh && vehicles.some((v) => v.id === veh.deviceId))) notFound();
  const nameOf = (deviceId: number) => vehicles.find((v) => v.id === deviceId)?.name ?? `Veicolo ${deviceId}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-5xl">
        <Link href="/autisti" className="text-sign text-sm font-medium hover:underline">‹ Autisti</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-semibold">{d.name}{!d.active && <span className="text-base text-muted font-normal ml-2">disattivato</span>}</h1>
          {editable && (
            <form action={deleteDriver}><input type="hidden" name="id" value={d.id} />
              <button className="text-sm text-offline hover:underline">Elimina autista</button></form>
          )}
        </div>
        <p className="text-muted mt-1">Account app: {d.userId ? "attivo" : "non ancora attivo (arriverà con l'app autista)"}.</p>

        <div className="mt-5 grid lg:grid-cols-[1fr_360px] gap-6">
          {editable ? <EditDriverForm driver={d} customers={isAdmin ? customers.map((c) => ({ id: c.id, name: c.name })) : []} /> : (
            <dl className="bg-surface border border-line p-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]">
              <dt className="text-muted">Telefono</dt><dd>{d.phone ?? "—"}</dd>
              <dt className="text-muted">Email</dt><dd>{d.email ?? "—"}</dd>
              <dt className="text-muted">Codice</dt><dd>{d.code ?? "—"}</dd>
              <dt className="text-muted">Patente</dt><dd>{[d.licenseCategories, d.licenseExpiry && `scade il ${new Date(`${d.licenseExpiry}T00:00:00`).toLocaleDateString("it-IT")}`].filter(Boolean).join(", ") || "—"}</dd>
            </dl>
          )}
          <div className="space-y-6">
            {editable ? (
              <AssignForm driverId={d.id} current={veh?.deviceId ?? null} active={d.active}
                vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, driver: v.driver ?? null }))} />
            ) : (
              <div className="bg-surface border border-line p-5">
                <h2 className="font-semibold">Veicolo abbinato</h2>
                <p className="mt-1">{veh ? nameOf(veh.deviceId) : "Nessuno"}</p>
              </div>
            )}
            <div className="bg-surface border border-line p-5">
              <h2 className="font-semibold">Storico abbinamenti</h2>
              {history.length === 0 ? <p className="text-sm text-muted mt-1">Nessun abbinamento finora.</p> : (
                <ul className="mt-2 text-sm divide-y divide-line">
                  {history.map((h) => (
                    <li key={h.id} className="py-1.5 flex justify-between gap-3">
                      <span className="font-medium">{nameOf(h.deviceId)}</span>
                      <span className="text-muted text-right">{dt(h.startAt)} – {h.endAt ? dt(h.endAt) : "in corso"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

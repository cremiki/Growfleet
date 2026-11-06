import Link from "next/link";
import { asc, isNotNull } from "drizzle-orm";
import { canEdit, ownsDriver, requireSession, scopeFor } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import { reminderState, REMINDER_COLOR } from "@/lib/reminders";
import { NewDriverForm } from "./DriverForms";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const s = await requireSession();
  const scope = await scopeFor(s);
  const db = await getDb();
  const isAdmin = s.role === "admin";
  const editable = await canEdit(s);
  const [all, customers, assigned, visible] = await Promise.all([
    db.select().from(schema.drivers).orderBy(asc(schema.drivers.name)),
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select({ deviceId: schema.vehicles.deviceId, driverId: schema.vehicles.driverId }).from(schema.vehicles).where(isNotNull(schema.vehicles.driverId)),
    fleet.listVehicles(scope),
  ]);
  // un cliente vede i suoi autisti e quelli abbinati ai suoi veicoli
  const visibleIds = new Set(visible.map((v) => v.id));
  const list = isAdmin ? all : all.filter((d) => d.customerId === s.customerId || assigned.some((a) => a.driverId === d.id && visibleIds.has(a.deviceId)));
  const vehicleOf = (driverId: number) => {
    const a = assigned.find((x) => x.driverId === driverId);
    return a ? visible.find((v) => v.id === a.deviceId) ?? null : null;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 grid xl:grid-cols-[1fr_340px] gap-8 max-w-7xl">
        <section className="min-w-0">
          <h1 className="text-2xl font-semibold">Autisti</h1>
          <p className="text-muted mt-1">
            Anagrafica dei conducenti e veicolo che stanno usando. In futuro ogni autista avrà un account sull&apos;app e si abbinerà al mezzo da solo.
          </p>
          <div className="mt-4 bg-surface border border-line overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-asphalt/60 text-left">
                <tr>{["Nome", "Codice", "Telefono", "Veicolo attuale", "Patente", ...(isAdmin ? ["Cliente"] : []), "App", ""].map((h, i) => <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-muted">{editable ? "Nessun autista: aggiungi il primo con il modulo a destra." : "Nessun autista."}</td></tr>}
                {list.map((d) => {
                  const v = vehicleOf(d.id);
                  const lic = d.licenseExpiry ? reminderState({ dueDate: d.licenseExpiry, dueKm: null, dueHours: null, doneAt: null }, null, null) : null;
                  return (
                    <tr key={d.id} className={`border-t border-line/70 ${d.active ? "" : "text-muted"}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/autisti/${d.id}`} className="text-sign font-semibold hover:underline">{d.name}</Link>
                        {!d.active && <span className="ml-2 text-xs">disattivato</span>}
                      </td>
                      <td className="px-3 py-2">{d.code ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.phone ? <a href={`tel:${d.phone.replace(/\s+/g, "")}`} className="hover:underline">{d.phone}</a> : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{v ? <Link href={`/veicoli/${v.id}`} className="hover:underline">{v.name}</Link> : <span className="text-muted">nessuno</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {d.licenseCategories ?? ""}
                        {d.licenseExpiry && lic && (
                          <span className="ml-1" style={{ color: lic.status === "ok" ? undefined : REMINDER_COLOR[lic.status] }}>
                            scade il {new Date(`${d.licenseExpiry}T00:00:00`).toLocaleDateString("it-IT")}
                          </span>
                        )}
                        {!d.licenseCategories && !d.licenseExpiry && "—"}
                      </td>
                      {isAdmin && <td className="px-3 py-2">{customers.find((c) => c.id === d.customerId)?.name ?? "—"}</td>}
                      <td className="px-3 py-2 text-muted whitespace-nowrap">{d.userId ? "Attivo" : "Non attivo"}</td>
                      <td className="px-3 py-2 text-right"><Link href={`/autisti/${d.id}`} className="text-sign hover:underline">{editable && ownsDriver(s, d) ? "Modifica" : "Apri"}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {editable && <NewDriverForm customers={isAdmin ? customers.map((c) => ({ id: c.id, name: c.name })) : []} />}
      </div>
    </div>
  );
}


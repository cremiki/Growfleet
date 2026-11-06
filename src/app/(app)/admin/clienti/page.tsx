import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import { deleteCustomer, deleteUser, toggleBlockUser } from "./actions";
import { CustomerForm, UserForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const me = await requireAdmin();
  const db = await getDb();
  const [customers, users, links] = await Promise.all([
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select().from(schema.users).orderBy(asc(schema.users.email)),
    db.select().from(schema.customerDevices),
  ]);

  let unassigned: number | null = null;
  try {
    const all = await fleet.listDevices();
    const assigned = new Set(links.map((l) => l.deviceId));
    unassigned = all.filter((d) => !assigned.has(d.id)).length;
  } catch {
    /* flespi non raggiungibile: la pagina resta utilizzabile */
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-8 grid xl:grid-cols-[1fr_340px] gap-10">
        <div className="space-y-10 min-w-0">
          <section>
            <h1 className="plate text-3xl font-bold">Clienti</h1>
            <p className="text-muted mt-1">Gli utenti di un cliente vedono solo i veicoli che gli assegni qui.</p>
            {unassigned ? (
              <p className="mt-3 border-l-4 border-idle bg-surface px-3 py-2 text-sm">
                {unassigned === 1 ? "1 veicolo non è assegnato" : `${unassigned} veicoli non sono assegnati`} a nessun cliente: li vede solo il team.
              </p>
            ) : null}
            {customers.length === 0 ? (
              <p className="mt-4 text-muted">Nessun cliente. Creane uno con il modulo a destra.</p>
            ) : (
              <table className="w-full mt-4 bg-surface border border-line text-[15px]">
                <thead className="text-left text-sm text-muted">
                  <tr className="border-b border-line"><th className="p-3 font-medium">Nome</th><th className="p-3 font-medium">Veicoli</th><th className="p-3 font-medium">Utenti</th><th /></tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const n = links.filter((l) => l.customerId === c.id).length;
                    return (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="p-3 font-semibold">{c.name}</td>
                        <td className="p-3">
                          <Link href={`/admin/clienti/${c.id}`} className="text-sign font-medium hover:underline">
                            {n === 0 ? "Assegna veicoli" : n === 1 ? "1 veicolo" : `${n} veicoli`}
                          </Link>
                        </td>
                        <td className="p-3">{users.filter((u) => u.customerId === c.id).length}</td>
                        <td className="p-3 text-right">
                          <form action={deleteCustomer}>
                            <input type="hidden" name="id" value={c.id} />
                            <button className="text-sm text-offline hover:underline" title="Elimina il cliente e i suoi utenti. I dispositivi in flespi non vengono toccati.">Elimina</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 className="plate text-3xl font-bold">Utenti</h2>
            <table className="w-full mt-4 bg-surface border border-line text-[15px]">
              <thead className="text-left text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="p-3 font-medium">Nome</th><th className="p-3 font-medium">Email</th><th className="p-3 font-medium">Accesso</th>
                  <th className="p-3 font-medium">Ultimo accesso</th><th className="p-3 font-medium">Stato</th><th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="p-3 font-semibold">{u.name}</td>
                    <td className="p-3 whitespace-nowrap">{u.email}</td>
                    <td className="p-3">{u.role === "admin" ? "Team (tutti i clienti)" : <>{customers.find((c) => c.id === u.customerId)?.name ?? "—"}<span className="block text-xs text-muted">{u.canEdit ? "Gestore flotta" : "Sola consultazione"}</span></>}</td>
                    <td className="p-3 whitespace-nowrap text-sm">{u.lastLoginAt ? u.lastLoginAt.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }) : <span className="text-muted">mai</span>}</td>
                    <td className="p-3 text-sm">{u.blocked ? <span className="text-offline font-semibold">Bloccato</span> : "Attivo"}</td>
                    <td className="p-3 text-right whitespace-nowrap text-sm">
                      <span className="inline-flex gap-3">
                        <Link href={`/admin/utenti/${u.id}`} className="text-sign hover:underline">Modifica</Link>
                        {u.id !== me.uid && (
                          <>
                            <form action={toggleBlockUser}><input type="hidden" name="id" value={u.id} />
                              <button className="text-sign hover:underline">{u.blocked ? "Sblocca" : "Blocca"}</button></form>
                            <form action={deleteUser}><input type="hidden" name="id" value={u.id} />
                              <button className="text-offline hover:underline">Elimina</button></form>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="space-y-8">
          <CustomerForm />
          <UserForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </div>
    </div>
  );
}

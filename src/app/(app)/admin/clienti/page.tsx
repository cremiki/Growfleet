import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import type { Subaccount } from "@/lib/types";
import { deleteCustomer, deleteUser } from "./actions";
import { CustomerForm, UserForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const me = await requireAdmin();
  const db = await getDb();
  const [customers, users] = await Promise.all([
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select().from(schema.users).orderBy(asc(schema.users.email)),
  ]);

  let subaccounts: Subaccount[] = [];
  let subError: string | null = null;
  try {
    subaccounts = await fleet.listSubaccounts();
  } catch (e) {
    subError = `Non riesco a leggere i subaccount flespi (serve un token Master): ${(e as Error).message}`;
  }
  const linked = new Set(customers.map((c) => c.flespiCid));
  const freeSubs = subaccounts.filter((s) => !linked.has(s.id));
  const subName = new Map(subaccounts.map((s) => [s.id, s.name]));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_340px] gap-10">
        <div className="space-y-10 min-w-0">
          <section>
            <h1 className="plate text-3xl font-bold">Clienti</h1>
            <p className="text-muted mt-1">Ogni cliente corrisponde a un subaccount flespi: i suoi utenti vedono solo i veicoli di quel subaccount.</p>
            {customers.length === 0 ? (
              <p className="mt-4 text-muted">Nessun cliente. Creane uno con il modulo a destra.</p>
            ) : (
              <table className="w-full mt-4 bg-surface border border-line text-[15px]">
                <thead className="text-left text-sm text-muted">
                  <tr className="border-b border-line"><th className="p-3 font-medium">Nome</th><th className="p-3 font-medium">Subaccount flespi</th><th className="p-3 font-medium">Utenti</th><th /></tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="p-3 font-semibold">{c.name}</td>
                      <td className="p-3">{c.flespiCid ? <>{c.flespiCid}{subName.get(c.flespiCid) ? <span className="text-muted">, {subName.get(c.flespiCid)}</span> : null}</> : <span className="text-offline">Non collegato</span>}</td>
                      <td className="p-3">{users.filter((u) => u.customerId === c.id).length}</td>
                      <td className="p-3 text-right">
                        <form action={deleteCustomer}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-sm text-offline hover:underline" title="Elimina il cliente e i suoi utenti. I dati in flespi non vengono toccati.">Elimina</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 className="plate text-3xl font-bold">Utenti</h2>
            <table className="w-full mt-4 bg-surface border border-line text-[15px]">
              <thead className="text-left text-sm text-muted">
                <tr className="border-b border-line"><th className="p-3 font-medium">Nome</th><th className="p-3 font-medium">Email</th><th className="p-3 font-medium">Accesso</th><th /></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="p-3 font-semibold">{u.name}</td>
                    <td className="p-3 break-all">{u.email}</td>
                    <td className="p-3">{u.role === "admin" ? "Team (tutti i clienti)" : customers.find((c) => c.id === u.customerId)?.name ?? "—"}</td>
                    <td className="p-3 text-right">
                      {u.id !== me.uid && (
                        <form action={deleteUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="text-sm text-offline hover:underline">Elimina</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="space-y-8">
          <CustomerForm subaccounts={freeSubs} subError={subError} />
          <UserForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </div>
    </div>
  );
}

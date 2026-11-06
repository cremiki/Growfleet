import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { EditUserForm } from "./EditUserForm";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [[u], customers] = await Promise.all([
    Number.isInteger(id) ? db.select().from(schema.users).where(eq(schema.users.id, id)) : Promise.resolve([]),
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
  ]);
  if (!u) notFound();
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-xl">
        <Link href="/admin/clienti" className="text-sign text-sm font-medium hover:underline">‹ Clienti e utenti</Link>
        <h1 className="text-2xl font-semibold mt-2">Modifica utente</h1>
        <p className="text-muted mt-1">
          {u.blocked ? "Account bloccato. " : ""}Ultimo accesso: {u.lastLoginAt ? u.lastLoginAt.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }) : "mai"}.
        </p>
        <EditUserForm
          user={{ id: u.id, name: u.name, email: u.email, role: u.role, customerId: u.customerId }}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          isSelf={u.id === me.uid}
        />
      </div>
    </div>
  );
}

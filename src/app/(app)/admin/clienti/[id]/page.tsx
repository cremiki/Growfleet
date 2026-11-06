import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import type { DeviceSummary } from "@/lib/types";
import { AssignForm } from "./AssignForm";

export const dynamic = "force-dynamic";

export default async function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [customer] = Number.isInteger(id) ? await db.select().from(schema.customers).where(eq(schema.customers.id, id)) : [];
  if (!customer) notFound();
  const [customers, links] = await Promise.all([db.select().from(schema.customers), db.select().from(schema.customerDevices)]);

  let devices: DeviceSummary[] = [];
  let error: string | null = null;
  try {
    devices = await fleet.listDevices();
  } catch (e) {
    error = `Non riesco a leggere i dispositivi da flespi: ${(e as Error).message}`;
  }
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const owners: Record<number, string[]> = {};
  for (const l of links) if (l.customerId !== id) (owners[l.deviceId] ??= []).push(names.get(l.customerId) ?? "");
  const selected = links.filter((l) => l.customerId === id).map((l) => l.deviceId);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/admin/clienti" className="text-sign font-medium text-sm hover:underline">‹ Clienti e utenti</Link>
        <h1 className="plate text-3xl font-bold mt-3">Veicoli di {customer.name}</h1>
        <p className="text-muted mt-1">Spunta i dispositivi flespi che gli utenti di questo cliente devono vedere.</p>
        {error ? (
          <p role="alert" className="mt-6 text-offline">{error}</p>
        ) : (
          <AssignForm customerId={id} devices={devices} selected={selected} owners={owners} />
        )}
      </div>
    </div>
  );
}

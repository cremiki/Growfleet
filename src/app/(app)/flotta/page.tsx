import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { FleetView } from "./FleetView";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const s = await requireSession();
  let customers: { id: number; name: string; deviceIds: number[] }[] = [];
  if (s.role === "admin") {
    const db = await getDb();
    const [rows, links] = await Promise.all([
      db.select().from(schema.customers),
      db.select().from(schema.customerDevices),
    ]);
    customers = rows
      .map((c) => ({ id: c.id, name: c.name, deviceIds: links.filter((l) => l.customerId === c.id).map((l) => l.deviceId) }))
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }
  return <FleetView isAdmin={s.role === "admin"} customers={customers} />;
}

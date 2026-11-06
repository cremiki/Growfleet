import { isNotNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { FleetView } from "./FleetView";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const s = await requireSession();
  let customers: { name: string; cid: number }[] = [];
  if (s.role === "admin") {
    const db = await getDb();
    const rows = await db.select().from(schema.customers).where(isNotNull(schema.customers.flespiCid));
    customers = rows.map((c) => ({ name: c.name, cid: c.flespiCid! })).sort((a, b) => a.name.localeCompare(b.name, "it"));
  }
  return <FleetView isAdmin={s.role === "admin"} customers={customers} />;
}

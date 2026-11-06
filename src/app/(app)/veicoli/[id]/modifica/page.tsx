import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { fleet } from "@/lib/flespi";
import { VehicleForm } from "./VehicleForm";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const detail = Number.isInteger(id) ? await fleet.getVehicle({ kind: "all" }, id) : null;
  if (!detail) notFound();
  const db = await getDb();
  const [[profile], customers, links, driverList] = await Promise.all([
    db.select().from(schema.vehicles).where(eq(schema.vehicles.deviceId, id)),
    db.select().from(schema.customers).orderBy(asc(schema.customers.name)),
    db.select().from(schema.customerDevices).where(eq(schema.customerDevices.deviceId, id)),
    db.select({ id: schema.drivers.id, name: schema.drivers.name, active: schema.drivers.active }).from(schema.drivers).orderBy(asc(schema.drivers.name)),
  ]);
  const st = detail.state;
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-4xl">
        <Link href={`/veicoli/${id}`} className="text-sign text-sm font-medium hover:underline">‹ Profilo del veicolo</Link>
        <h1 className="text-2xl font-semibold mt-2">Modifica {detail.state.name}</h1>
        <p className="text-muted mt-1">
          Dispositivo flespi: {detail.state.deviceName}{detail.state.ident ? `, IMEI ${detail.state.ident}` : ""}. I dati di posizione e i contatori arrivano da flespi e non si modificano qui.
        </p>
        <VehicleForm
          deviceId={id}
          profile={profile ?? null}
          deviceName={detail.state.deviceName ?? detail.state.name}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          assigned={links.map((l) => l.customerId)}
          drivers={driverList.filter((d) => d.active || d.id === profile?.driverId).map((d) => ({ id: d.id, name: d.name }))}
          odometer={{ current: st.odometerKm, raw: st.odometerKm != null ? st.odometerKm - (st.odoOffset ?? 0) : null, offset: st.odoOffset ?? null }}
          fuelLevel={st.fuelLevel}
        />
      </div>
    </div>
  );
}

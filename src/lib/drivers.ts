import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";

/**
 * Abbina un autista a un veicolo (o toglie l'abbinamento con driverId = null), tenendo lo storico.
 * Un autista guida un veicolo alla volta e un veicolo ha un autista alla volta.
 */
export async function setAssignment(deviceId: number, driverId: number | null, source: "manuale" | "app" | "badge" = "manuale") {
  const db = await getDb();
  const [cur] = await db.select({ driverId: schema.vehicles.driverId }).from(schema.vehicles).where(eq(schema.vehicles.deviceId, deviceId));
  if ((cur?.driverId ?? null) === driverId) return;
  const now = new Date();
  await db.update(schema.driverAssignments).set({ endAt: now })
    .where(and(eq(schema.driverAssignments.deviceId, deviceId), isNull(schema.driverAssignments.endAt)));
  if (driverId != null) {
    await db.update(schema.driverAssignments).set({ endAt: now })
      .where(and(eq(schema.driverAssignments.driverId, driverId), isNull(schema.driverAssignments.endAt)));
    await db.update(schema.vehicles).set({ driverId: null }).where(eq(schema.vehicles.driverId, driverId));
    await db.insert(schema.driverAssignments).values({ driverId, deviceId, startAt: now, source });
  }
  await db.insert(schema.vehicles).values({ deviceId, driverId, updatedAt: now })
    .onConflictDoUpdate({ target: schema.vehicles.deviceId, set: { driverId, updatedAt: now } });
}

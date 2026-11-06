import "server-only";
import { sql, count, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { env, isMock } from "../env";

export type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: Promise<DB> };

async function connect(): Promise<DB> {
  let db: DB;
  if (env.databaseUrl) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(env.databaseUrl, { max: 5, prepare: false });
    db = drizzle(client, { schema });
  } else {
    // Postgres embedded per sviluppo locale / demo (su Vercel finisce in /tmp e non è persistente)
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir = process.env.VERCEL ? "/tmp/pglite" : ".data/pglite";
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    db = drizzle(client, { schema }) as unknown as DB;
  }
  await bootstrap(db);
  return db;
}

async function bootstrap(db: DB) {
  for (const stmt of schema.BOOTSTRAP_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(sql.raw(stmt));
  }
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n > 0) return;

  if (env.adminEmail && env.adminPassword) {
    await db.insert(schema.users).values({
      email: env.adminEmail.toLowerCase(),
      name: "Amministratore",
      passwordHash: await bcrypt.hash(env.adminPassword, 10),
      role: "admin",
    }).onConflictDoNothing();
  } else if (isMock) {
    // Account di prova per la modalità demo
    const hash = await bcrypt.hash("demo1234", 10);
    const [rossi, bianchi] = await db.insert(schema.customers)
      .values([{ name: "Trasporti Rossi S.r.l." }, { name: "Logistica Bianchi" }])
      .returning();
    await db.insert(schema.customerDevices).values([
      ...[501, 502, 503, 504, 505].map((deviceId) => ({ customerId: rossi.id, deviceId })),
      ...[601, 602, 603, 604].map((deviceId) => ({ customerId: bianchi.id, deviceId })),
    ]).onConflictDoNothing();
    await db.insert(schema.vehicles).values([
      { deviceId: 501, plate: "FX 482 KL", make: "Iveco", model: "Daily", type: "furgone", fuelType: "Diesel", tankL: 90, consumptionL100: 10.5, speedLimit: 110 },
      { deviceId: 502, plate: "GA 107 RT", make: "Fiat", model: "Ducato", type: "furgone", fuelType: "Diesel", tankL: 90 },
      { deviceId: 503, plate: "EZ 930 PM", make: "Mercedes", model: "Sprinter", type: "furgone", fuelType: "Diesel", tankL: 75 },
      { deviceId: 601, plate: "GD 554 LV", make: "Scania", model: "R450", type: "camion", fuelType: "Diesel", tankL: 600, consumptionL100: 29, speedLimit: 90 },
      { deviceId: 602, plate: "FN 309 CE", make: "Volvo", model: "FH", type: "camion", fuelType: "Diesel", tankL: 600 },
    ]).onConflictDoNothing();
    const ds = await db.insert(schema.drivers).values([
      { name: "Luca Bianchi", phone: "+39 333 1234567", code: "A017", licenseCategories: "B, C", licenseExpiry: "2029-03-14", customerId: rossi.id },
      { name: "Paolo Verdi", phone: "+39 347 7654321", code: "B204", licenseCategories: "C, CE", licenseExpiry: "2026-11-28", customerId: bianchi.id },
      { name: "Anna Neri", phone: "+39 340 1112223", code: "A031", licenseCategories: "B", licenseExpiry: "2031-06-02", customerId: rossi.id },
    ]).returning({ id: schema.drivers.id });
    await db.update(schema.vehicles).set({ driverId: ds[0].id }).where(eq(schema.vehicles.deviceId, 501));
    await db.update(schema.vehicles).set({ driverId: ds[1].id }).where(eq(schema.vehicles.deviceId, 601));
    await db.insert(schema.driverAssignments).values([
      { driverId: ds[0].id, deviceId: 501 }, { driverId: ds[1].id, deviceId: 601 },
    ]);
    await db.insert(schema.users).values([
      { email: "admin@demo.it", name: "Team operativo", passwordHash: hash, role: "admin" },
      { email: "cliente@demo.it", name: "Marco Rossi", passwordHash: hash, role: "customer", customerId: rossi.id },
    ]).onConflictDoNothing();
  }
}

export function getDb(): Promise<DB> {
  if (!g.__db) {
    g.__db = connect().catch((e) => {
      g.__db = undefined;
      throw e;
    });
  }
  return g.__db;
}

export { schema };

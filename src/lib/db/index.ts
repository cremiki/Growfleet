import "server-only";
import { sql, count } from "drizzle-orm";
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
    const [c] = await db.insert(schema.customers)
      .values({ name: "Trasporti Rossi S.r.l.", flespiCid: 1001 })
      .onConflictDoNothing().returning();
    await db.insert(schema.customers)
      .values({ name: "Logistica Bianchi", flespiCid: 1002 })
      .onConflictDoNothing();
    await db.insert(schema.users).values([
      { email: "admin@demo.it", name: "Team operativo", passwordHash: hash, role: "admin" },
      { email: "cliente@demo.it", name: "Marco Rossi", passwordHash: hash, role: "customer", customerId: c?.id ?? 1 },
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

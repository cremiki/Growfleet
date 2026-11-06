import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type SessionPayload } from "./token";
import { isMock } from "../env";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const s = await requireSession();
  if (s.role !== "admin") redirect("/flotta");
  return s;
}

export async function createSession(p: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(p), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Perimetro dati dell'utente.
 * - admin: tutti i veicoli visibili al token flespi; può restringere a un cliente.
 * - customer: solo i dispositivi assegnati al suo cliente (tabella customer_devices).
 * Le assegnazioni vengono lette dal DB a ogni richiesta: una modifica in admin ha effetto subito.
 */
export type Scope = { kind: "all" } | { kind: "customer"; customerId: number; deviceIds: number[] };

export class ScopeError extends Error {}

async function devicesOf(customerId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.select({ d: schema.customerDevices.deviceId }).from(schema.customerDevices)
    .where(eq(schema.customerDevices.customerId, customerId));
  return rows.map((r) => r.d);
}

export async function scopeFor(s: SessionPayload, filterCustomerId?: number | null): Promise<Scope> {
  if (s.role === "admin") {
    return filterCustomerId
      ? { kind: "customer", customerId: filterCustomerId, deviceIds: await devicesOf(filterCustomerId) }
      : { kind: "all" };
  }
  if (!s.customerId) throw new ScopeError("Utente senza cliente associato.");
  return { kind: "customer", customerId: s.customerId, deviceIds: await devicesOf(s.customerId) };
}

export { isMock };

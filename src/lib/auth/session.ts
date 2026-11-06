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
  // un utente bloccato o eliminato perde l'accesso anche se ha ancora la sessione aperta
  const db = await getDb();
  const [u] = await db.select({ blocked: schema.users.blocked }).from(schema.users).where(eq(schema.users.id, s.uid));
  if (!u || u.blocked) redirect("/login?bloccato=1");
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
  const db = await getDb();
  const [u] = await db.select({ blocked: schema.users.blocked }).from(schema.users).where(eq(schema.users.id, s.uid));
  if (!u || u.blocked) throw new ScopeError("Il tuo account è bloccato o non esiste più.");
  if (s.role === "admin") {
    return filterCustomerId
      ? { kind: "customer", customerId: filterCustomerId, deviceIds: await devicesOf(filterCustomerId) }
      : { kind: "all" };
  }
  if (!s.customerId) throw new ScopeError("Utente senza cliente associato.");
  return { kind: "customer", customerId: s.customerId, deviceIds: await devicesOf(s.customerId) };
}

export { isMock };

/**
 * Chi può modificare i dati della flotta (profilo veicolo, manutenzioni, autisti):
 * il team sempre; gli utenti di un cliente se non sono in sola consultazione, e solo sui propri veicoli.
 */
export async function canEdit(s: SessionPayload): Promise<boolean> {
  if (s.role === "admin") return true;
  const db = await getDb();
  const [u] = await db.select({ canEdit: schema.users.canEdit, blocked: schema.users.blocked }).from(schema.users).where(eq(schema.users.id, s.uid));
  return !!u && !u.blocked && u.canEdit;
}

export class EditError extends Error {}

/** Per le azioni di modifica: verifica il permesso e, se indicato, che il veicolo sia del cliente */
export async function requireEditor(deviceId?: number): Promise<{ s: SessionPayload; scope: Scope }> {
  const s = await requireSession();
  if (!(await canEdit(s))) throw new EditError("Il tuo utente è in sola consultazione: chiedi all'amministratore di abilitare le modifiche.");
  const scope = await scopeFor(s);
  if (deviceId != null && scope.kind === "customer" && !scope.deviceIds.includes(deviceId)) throw new EditError("Veicolo non trovato.");
  return { s, scope };
}

/** Un utente cliente gestisce solo gli autisti del proprio cliente */
export function ownsDriver(s: SessionPayload, d: { customerId: number | null }): boolean {
  return s.role === "admin" || (d.customerId != null && d.customerId === s.customerId);
}

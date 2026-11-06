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
 * - admin: tutto l'account flespi (incluso ogni subaccount); può filtrare per cliente.
 * - customer: solo il subaccount flespi del proprio cliente.
 * Il cid viene letto dal DB a ogni richiesta, così una modifica in admin ha effetto subito.
 */
export type Scope = { kind: "all" } | { kind: "customer"; cid: number };

export class ScopeError extends Error {}

export async function scopeFor(s: SessionPayload, filterCid?: number | null): Promise<Scope> {
  if (s.role === "admin") {
    return filterCid ? { kind: "customer", cid: filterCid } : { kind: "all" };
  }
  if (!s.customerId) throw new ScopeError("Utente senza cliente associato.");
  const db = await getDb();
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, s.customerId));
  if (!c?.flespiCid) throw new ScopeError("Il cliente non è collegato a un subaccount flespi.");
  return { kind: "customer", cid: c.flespiCid };
}

export { isMock };

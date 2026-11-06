"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/lib/db";
import { createSession, requireSession } from "@/lib/auth/session";

export type FormState = { error?: string; ok?: string };

export async function updateName(_: FormState, form: FormData): Promise<FormState> {
  const s = await requireSession();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Inserisci nome e cognome." };
  const db = await getDb();
  await db.update(schema.users).set({ name }).where(eq(schema.users.id, s.uid));
  await createSession({ ...s, name }); // aggiorna il nome mostrato in alto
  return { ok: "Nome aggiornato." };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const s = await requireSession();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const repeat = String(form.get("repeat") ?? "");
  if (next.length < 8) return { error: "La nuova password deve avere almeno 8 caratteri." };
  if (next !== repeat) return { error: "Le due nuove password non coincidono." };
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, s.uid));
  if (!u || !(await bcrypt.compare(current, u.passwordHash))) return { error: "La password attuale non è corretta." };
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(schema.users.id, s.uid));
  return { ok: "Password cambiata." };
}

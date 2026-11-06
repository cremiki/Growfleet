"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";

export type FormState = { error?: string; ok?: string };

export async function createCustomer(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Inserisci il nome del cliente." };
  const db = await getDb();
  await db.insert(schema.customers).values({ name });
  revalidatePath("/admin/clienti");
  return { ok: `Cliente ${name} creato. Ora assegnagli i veicoli.` };
}

export async function deleteCustomer(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const db = await getDb();
  await db.delete(schema.customers).where(eq(schema.customers.id, id));
  revalidatePath("/admin/clienti");
}

export async function saveAssignments(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const customerId = Number(form.get("customerId"));
  const ids = Array.from(new Set(form.getAll("device").map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.customerDevices).where(eq(schema.customerDevices.customerId, customerId));
    if (ids.length) await tx.insert(schema.customerDevices).values(ids.map((deviceId) => ({ customerId, deviceId })));
  });
  revalidatePath("/admin/clienti");
  revalidatePath(`/admin/clienti/${customerId}`);
  return { ok: ids.length === 1 ? "1 veicolo assegnato." : `${ids.length} veicoli assegnati.` };
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Inserisci nome e cognome."),
  email: z.string().trim().toLowerCase().email("L'email non è valida."),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri."),
  role: z.enum(["admin", "customer"]),
  customerId: z.coerce.number().int().positive().optional(),
});

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = userSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
    role: form.get("role"),
    customerId: form.get("customerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.role === "customer" && !d.customerId) return { error: "Scegli il cliente a cui appartiene l'utente." };
  const db = await getDb();
  try {
    await db.insert(schema.users).values({
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 10),
      role: d.role,
      customerId: d.role === "customer" ? d.customerId! : null,
    });
  } catch {
    return { error: "Esiste già un utente con questa email." };
  }
  revalidatePath("/admin/clienti");
  return { ok: `Utente ${d.email} creato.` };
}

export async function deleteUser(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("id"));
  if (id === me.uid) return; // non si può eliminare il proprio account
  const db = await getDb();
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/admin/clienti");
}

export async function toggleBlockUser(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("id"));
  if (id === me.uid) return; // non ci si blocca da soli
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) return;
  await db.update(schema.users).set({ blocked: !u.blocked }).where(eq(schema.users.id, id));
  revalidatePath("/admin/clienti");
}

const editSchema = z.object({
  name: z.string().trim().min(2, "Inserisci nome e cognome."),
  email: z.string().trim().toLowerCase().email("L'email non è valida."),
  role: z.enum(["admin", "customer"]),
  customerId: z.coerce.number().int().positive().optional(),
  password: z.string().optional(),
});

export async function updateUser(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const id = Number(form.get("id"));
  const parsed = editSchema.safeParse({
    name: form.get("name"), email: form.get("email"), role: form.get("role"),
    customerId: form.get("customerId") || undefined, password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.role === "customer" && !d.customerId) return { error: "Scegli il cliente a cui appartiene l'utente." };
  if (id === me.uid && d.role !== "admin") return { error: "Non puoi togliere a te stesso l'accesso da team." };
  if (d.password && d.password.length < 8) return { error: "La nuova password deve avere almeno 8 caratteri." };
  const db = await getDb();
  try {
    await db.update(schema.users).set({
      name: d.name, email: d.email, role: d.role,
      customerId: d.role === "customer" ? d.customerId! : null,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    }).where(eq(schema.users.id, id));
  } catch {
    return { error: "Esiste già un utente con questa email." };
  }
  revalidatePath("/admin/clienti");
  return { ok: d.password ? "Utente salvato e password reimpostata." : "Utente salvato." };
}

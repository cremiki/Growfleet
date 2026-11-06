"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { EditError, ownsDriver, requireEditor, scopeFor } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/token";
import { fleet } from "@/lib/flespi";
import { setAssignment } from "@/lib/drivers";

export type FormState = { error?: string; ok?: string };

const opt = (s: FormDataEntryValue | null) => {
  const v = String(s ?? "").trim();
  return v === "" ? null : v;
};

const driverSchema = z.object({
  name: z.string().trim().min(2, "Inserisci nome e cognome."),
  phone: z.string().max(30).nullable(),
  email: z.string().email("L'email non è valida.").nullable(),
  code: z.string().max(40).nullable(),
  licenseNumber: z.string().max(40).nullable(),
  licenseCategories: z.string().max(40).nullable(),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  customerId: z.number().int().positive().nullable(),
  active: z.boolean(),
  notes: z.string().max(2000).nullable(),
});

function read(form: FormData) {
  const c = opt(form.get("customerId"));
  return driverSchema.safeParse({
    name: String(form.get("name") ?? ""),
    phone: opt(form.get("phone")),
    email: opt(form.get("email"))?.toLowerCase() ?? null,
    code: opt(form.get("code")),
    licenseNumber: opt(form.get("licenseNumber"))?.toUpperCase() ?? null,
    licenseCategories: opt(form.get("licenseCategories"))?.toUpperCase() ?? null,
    licenseExpiry: opt(form.get("licenseExpiry")),
    customerId: c ? Number(c) : null,
    active: form.get("active") !== null ? form.get("active") === "on" : true,
    notes: opt(form.get("notes")),
  });
}

/** Permesso di modifica; restituisce la sessione o il messaggio d'errore */
async function editor(): Promise<SessionPayload | { error: string }> {
  try { return (await requireEditor()).s; } catch (e) {
    if (e instanceof EditError) return { error: e.message };
    throw e;
  }
}

/** Autista modificabile dall'utente: il team tutti, un cliente solo i propri */
async function myDriver(s: SessionPayload, id: number) {
  const db = await getDb();
  const [d] = await db.select().from(schema.drivers).where(eq(schema.drivers.id, id));
  return d && ownsDriver(s, d) ? d : null;
}

export async function createDriver(_: FormState, form: FormData): Promise<FormState> {
  const s = await editor();
  if ("error" in s) return s;
  const parsed = read(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // l'autista creato da un cliente appartiene sempre a quel cliente
  if (s.role !== "admin") parsed.data.customerId = s.customerId;
  const db = await getDb();
  const [d] = await db.insert(schema.drivers).values(parsed.data).returning({ id: schema.drivers.id });
  revalidatePath("/autisti");
  redirect(`/autisti/${d.id}`);
}

export async function updateDriver(_: FormState, form: FormData): Promise<FormState> {
  const s = await editor();
  if ("error" in s) return s;
  const id = Number(form.get("id"));
  if (!(await myDriver(s, id))) return { error: "Autista non trovato." };
  const parsed = read(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (s.role !== "admin") parsed.data.customerId = s.customerId;
  const db = await getDb();
  await db.update(schema.drivers).set(parsed.data).where(eq(schema.drivers.id, id));
  // un autista disattivato non resta abbinato a un veicolo
  if (!parsed.data.active) {
    const [v] = await db.select({ deviceId: schema.vehicles.deviceId }).from(schema.vehicles).where(eq(schema.vehicles.driverId, id));
    if (v) await setAssignment(v.deviceId, null);
  }
  revalidatePath("/autisti");
  revalidatePath(`/autisti/${id}`);
  return { ok: "Autista salvato." };
}

export async function assignVehicle(_: FormState, form: FormData): Promise<FormState> {
  const s = await editor();
  if ("error" in s) return s;
  const driverId = Number(form.get("driverId"));
  const raw = opt(form.get("deviceId"));
  const db = await getDb();
  const d = await myDriver(s, driverId);
  if (!d) return { error: "Autista non trovato." };
  if (!d.active && raw) return { error: "L'autista è disattivato: riattivalo per abbinarlo a un veicolo." };
  if (raw) {
    const deviceId = Number(raw);
    const v = await fleet.getVehicle(await scopeFor(s), deviceId); // un cliente abbina solo ai propri veicoli
    if (!v) return { error: "Veicolo non trovato." };
    await setAssignment(deviceId, driverId);
    revalidatePath(`/autisti/${driverId}`);
    revalidatePath("/autisti");
    return { ok: `Abbinato a ${v.state.name}.` };
  }
  const [cur] = await db.select({ deviceId: schema.vehicles.deviceId }).from(schema.vehicles).where(eq(schema.vehicles.driverId, driverId));
  if (cur) await setAssignment(cur.deviceId, null);
  revalidatePath(`/autisti/${driverId}`);
  revalidatePath("/autisti");
  return { ok: "Abbinamento rimosso." };
}

export async function deleteDriver(form: FormData) {
  const s = await editor();
  if ("error" in s) return;
  const id = Number(form.get("id"));
  if (!(await myDriver(s, id))) return;
  const db = await getDb();
  const [cur] = await db.select({ deviceId: schema.vehicles.deviceId }).from(schema.vehicles).where(eq(schema.vehicles.driverId, id));
  if (cur) await setAssignment(cur.deviceId, null);
  await db.update(schema.driverAssignments).set({ endAt: new Date() })
    .where(and(eq(schema.driverAssignments.driverId, id), isNull(schema.driverAssignments.endAt)));
  await db.delete(schema.drivers).where(eq(schema.drivers.id, id));
  revalidatePath("/autisti");
  redirect("/autisti");
}

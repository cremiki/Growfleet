"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { fleet } from "@/lib/flespi";

export type FormState = { error?: string; ok?: string };

const opt = (s: FormDataEntryValue | null) => {
  const v = String(s ?? "").trim();
  return v === "" ? null : v;
};
const num = (s: FormDataEntryValue | null) => {
  const v = opt(s);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

async function ensureDevice(id: number) {
  // il veicolo deve esistere fra i dispositivi visibili al token flespi
  const v = await fleet.getVehicle({ kind: "all" }, id);
  if (!v) throw new Error("Veicolo non trovato.");
  return v;
}

const profileSchema = z.object({
  plate: z.string().max(20).nullable(),
  make: z.string().max(60).nullable(),
  model: z.string().max(60).nullable(),
  iconText: z.string().max(30).nullable(),
  type: z.enum(schema.VEHICLE_TYPES).nullable(),
  year: z.number().int().min(1950).max(2100).nullable(),
  vin: z.string().max(30).nullable(),
  driver: z.string().max(80).nullable(),
  fuelType: z.string().max(30).nullable(),
  tankL: z.number().min(0).max(5000).nullable(),
  consumptionL100: z.number().min(0).max(200).nullable(),
  co2GKm: z.number().min(0).max(3000).nullable(),
  phone: z.string().max(30).nullable(),
  notes: z.string().max(2000).nullable(),
  unavailable: z.boolean(),
  speedLimit: z.number().int().min(5).max(300).nullable(),
  ecoSpeed: z.number().int().min(5).max(300).nullable(),
  longStopMin: z.number().int().min(1).max(1440).nullable(),
});

export async function saveVehicle(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("deviceId"));
  try { await ensureDevice(id); } catch (e) { return { error: (e as Error).message }; }

  const raw = {
    plate: opt(form.get("plate"))?.toUpperCase() ?? null,
    make: opt(form.get("make")),
    model: opt(form.get("model")),
    iconText: opt(form.get("iconText")),
    type: opt(form.get("type")),
    year: num(form.get("year")),
    vin: opt(form.get("vin"))?.toUpperCase() ?? null,
    driver: opt(form.get("driver")),
    fuelType: opt(form.get("fuelType")),
    tankL: num(form.get("tankL")),
    consumptionL100: num(form.get("consumptionL100")),
    co2GKm: num(form.get("co2GKm")),
    phone: opt(form.get("phone")),
    notes: opt(form.get("notes")),
    unavailable: form.get("unavailable") === "on",
    speedLimit: num(form.get("speedLimit")),
    ecoSpeed: num(form.get("ecoSpeed")),
    longStopMin: num(form.get("longStopMin")),
  };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0].path[0] ?? "");
    const LABELS: Record<string, string> = {
      year: "L'anno", tankL: "La capacità del serbatoio", consumptionL100: "Il consumo medio", co2GKm: "Le emissioni di CO2",
      speedLimit: "Il limite di velocità", ecoSpeed: "La velocità ecologica", longStopMin: "La sosta eccessiva",
    };
    return { error: `${LABELS[field] ?? "Un campo"} non è valido: controlla il valore inserito.` };
  }
  const db = await getDb();
  const values = { ...parsed.data, deviceId: id, updatedAt: new Date() };
  await db.insert(schema.vehicles).values(values).onConflictDoUpdate({ target: schema.vehicles.deviceId, set: values });

  // Accesso: quali clienti vedono il veicolo
  if (form.get("accessSection") === "1") {
    const customerIds = form.getAll("customer").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    await db.transaction(async (tx) => {
      await tx.delete(schema.customerDevices).where(eq(schema.customerDevices.deviceId, id));
      if (customerIds.length) await tx.insert(schema.customerDevices).values(customerIds.map((customerId) => ({ customerId, deviceId: id })));
    });
  }
  revalidatePath(`/veicoli/${id}`);
  revalidatePath("/veicoli");
  return { ok: "Veicolo salvato." };
}

const reminderSchema = z.object({
  kind: z.enum(["manutenzione", "documento"]),
  title: z.string().trim().min(2, "Scrivi il titolo, per esempio \"Tagliando\" o \"Revisione\"."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dueKm: z.number().min(0).nullable(),
  dueHours: z.number().min(0).nullable(),
  notes: z.string().max(1000).nullable(),
});

export async function addReminder(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("deviceId"));
  try { await ensureDevice(id); } catch (e) { return { error: (e as Error).message }; }
  const parsed = reminderSchema.safeParse({
    kind: form.get("kind"),
    title: String(form.get("title") ?? ""),
    dueDate: opt(form.get("dueDate")),
    dueKm: num(form.get("dueKm")),
    dueHours: num(form.get("dueHours")),
    notes: opt(form.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message.startsWith("Scrivi") ? parsed.error.issues[0].message : "Controlla i valori inseriti." };
  const d = parsed.data;
  if (!d.dueDate && d.dueKm == null && d.dueHours == null) return { error: "Indica almeno una scadenza: data, chilometri o ore motore." };
  const db = await getDb();
  await db.insert(schema.reminders).values({ deviceId: id, ...d });
  revalidatePath(`/veicoli/${id}`);
  revalidatePath("/veicoli");
  return { ok: d.kind === "manutenzione" ? "Promemoria aggiunto." : "Scadenza aggiunta." };
}

export async function completeReminder(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const deviceId = Number(form.get("deviceId"));
  const db = await getDb();
  await db.update(schema.reminders).set({ doneAt: new Date() })
    .where(and(eq(schema.reminders.id, id), eq(schema.reminders.deviceId, deviceId)));
  revalidatePath(`/veicoli/${deviceId}`);
  revalidatePath("/veicoli");
}

export async function deleteReminder(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const deviceId = Number(form.get("deviceId"));
  const db = await getDb();
  await db.delete(schema.reminders).where(and(eq(schema.reminders.id, id), eq(schema.reminders.deviceId, deviceId)));
  revalidatePath(`/veicoli/${deviceId}`);
  revalidatePath("/veicoli");
}

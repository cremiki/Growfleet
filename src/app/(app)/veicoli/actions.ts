"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { fleet } from "@/lib/flespi";
import { addMonths, todayIso } from "@/lib/reminders";
import { setAssignment } from "@/lib/drivers";

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
  let detail;
  try { detail = await ensureDevice(id); } catch (e) { return { error: (e as Error).message }; }

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
  // Correzione del contachilometri: si inserisce il valore reale, si salva la differenza dal dato del dispositivo
  const st = detail.state;
  const rawOdo = st.odometerKm != null ? st.odometerKm - (st.odoOffset ?? 0) : null;
  let odoOffsetKm = st.odoOffset ?? null;
  const odoReal = num(form.get("odoReal"));
  if (Number.isNaN(odoReal)) return { error: "Il contachilometri reale non è valido." };
  if (odoReal != null) {
    if (rawOdo == null) return { error: "Il dispositivo non invia il contachilometri: la correzione non si può applicare." };
    if (st.odometerKm == null || Math.abs(odoReal - st.odometerKm) >= 0.5) odoOffsetKm = Math.round((odoReal - rawOdo) * 10) / 10;
  } else if (form.get("odoReal") !== null) {
    odoOffsetKm = null; // campo svuotato: niente correzione
  }

  // Autista: abbinamento dalla sezione Autisti, con storico
  const driverId = num(form.get("driverId"));
  const newDriver = driverId != null && !Number.isNaN(driverId) ? driverId : null;
  const db = await getDb();
  const values = { ...parsed.data, driverId: newDriver, odoOffsetKm, deviceId: id, updatedAt: new Date() };
  const { driverId: _ignored, ...rest } = values;
  await db.insert(schema.vehicles).values(rest).onConflictDoUpdate({ target: schema.vehicles.deviceId, set: rest });
  await setAssignment(id, newDriver);

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
  startKm: z.number().min(0).nullable(),
  intervalKm: z.number().positive().nullable(),
  startHours: z.number().min(0).nullable(),
  intervalHours: z.number().positive().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  intervalMonths: z.number().int().positive().max(240).nullable(),
  notes: z.string().max(1000).nullable(),
});

/**
 * Nuova scadenza. Con un intervallo ("ogni 15.000 km") la scadenza si calcola dall'ultimo intervento:
 * km di partenza + intervallo. Se la scadenza è scritta a mano, vale quella.
 */
export async function addReminder(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("deviceId"));
  let detail;
  try { detail = await ensureDevice(id); } catch (e) { return { error: (e as Error).message }; }
  const raw = {
    kind: form.get("kind"),
    title: String(form.get("title") ?? ""),
    dueDate: opt(form.get("dueDate")),
    dueKm: num(form.get("dueKm")),
    dueHours: num(form.get("dueHours")),
    startKm: num(form.get("startKm")),
    intervalKm: num(form.get("intervalKm")),
    startHours: num(form.get("startHours")),
    intervalHours: num(form.get("intervalHours")),
    startDate: opt(form.get("startDate")),
    intervalMonths: num(form.get("intervalMonths")),
    notes: opt(form.get("notes")),
  };
  const parsed = reminderSchema.safeParse(raw);
  if (!parsed.success) {
    const m = parsed.error.issues[0].message;
    return { error: m.startsWith("Scrivi") ? m : "Controlla i valori inseriti: numeri positivi e date valide." };
  }
  const d = parsed.data;
  const st = detail.state;
  if (d.intervalKm != null) {
    d.startKm ??= st.odometerKm;
    if (d.startKm == null) return { error: "Il veicolo non invia il contachilometri: indica i km dell'ultimo intervento." };
    d.dueKm ??= d.startKm + d.intervalKm;
  }
  if (d.intervalHours != null) {
    d.startHours ??= st.engineHours;
    if (d.startHours == null) return { error: "Il veicolo non invia le ore motore: indica le ore dell'ultimo intervento." };
    d.dueHours ??= d.startHours + d.intervalHours;
  }
  if (d.intervalMonths != null) {
    d.startDate ??= todayIso();
    d.dueDate ??= addMonths(d.startDate, d.intervalMonths);
  }
  // senza intervallo, i km e le ore di partenza servono comunque per la barra di avanzamento
  if (d.dueKm != null) d.startKm ??= st.odometerKm;
  if (d.dueHours != null) d.startHours ??= st.engineHours;
  if (!d.dueDate && d.dueKm == null && d.dueHours == null) {
    return { error: "Indica quando scade: ogni quanti km, ore o mesi, oppure una data o un chilometraggio preciso." };
  }
  const db = await getDb();
  await db.insert(schema.reminders).values({ deviceId: id, ...d, startDate: d.startDate ?? todayIso() });
  revalidatePath(`/veicoli/${id}`);
  revalidatePath("/veicoli");
  return { ok: d.kind === "manutenzione" ? "Promemoria aggiunto." : "Scadenza aggiunta." };
}

/** Segna come fatto; se il promemoria si ripete ne crea subito il successivo dai valori attuali */
export async function completeReminder(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const deviceId = Number(form.get("deviceId"));
  const db = await getDb();
  const [r] = await db.select().from(schema.reminders).where(and(eq(schema.reminders.id, id), eq(schema.reminders.deviceId, deviceId)));
  if (!r || r.doneAt) return;
  await db.update(schema.reminders).set({ doneAt: new Date() }).where(eq(schema.reminders.id, id));
  if (r.intervalKm != null || r.intervalHours != null || r.intervalMonths != null) {
    const v = await fleet.getVehicle({ kind: "all" }, deviceId).catch(() => null);
    const odo = v?.state.odometerKm ?? null;
    const hrs = v?.state.engineHours ?? null;
    const today = todayIso();
    await db.insert(schema.reminders).values({
      deviceId, kind: r.kind, title: r.title, notes: r.notes,
      intervalKm: r.intervalKm, intervalHours: r.intervalHours, intervalMonths: r.intervalMonths,
      startKm: r.intervalKm != null ? odo : null,
      dueKm: r.intervalKm != null && odo != null ? odo + r.intervalKm : null,
      startHours: r.intervalHours != null ? hrs : null,
      dueHours: r.intervalHours != null && hrs != null ? hrs + r.intervalHours : null,
      startDate: today,
      dueDate: r.intervalMonths != null ? addMonths(today, r.intervalMonths) : null,
    });
  }
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

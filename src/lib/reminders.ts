// Stato di una scadenza (manutenzione o documento) rispetto a data, km e ore motore attuali

export type ReminderLike = {
  dueDate: string | null; // "YYYY-MM-DD"
  dueKm: number | null;
  dueHours: number | null;
  startKm?: number | null;
  startHours?: number | null;
  startDate?: string | null;
  createdAt?: Date | string | null;
  doneAt: Date | string | null;
};

export type ReminderStatus = "done" | "overdue" | "soon" | "ok";

export const SOON = { days: 30, km: 1000, hours: 50 };

/** Avanzamento da 0 a 1 (può superare 1 se scaduto) per una grandezza con inizio e scadenza */
const prog = (now: number | null, start: number | null | undefined, due: number | null) =>
  now != null && start != null && due != null && due > start ? (now - start) / (due - start) : null;

export function reminderState(r: ReminderLike, odo: number | null, hours: number | null, now = Date.now()) {
  const dueMs = r.dueDate ? new Date(`${r.dueDate}T23:59:59`).getTime() : null;
  const daysLeft = dueMs != null ? Math.ceil((dueMs - now) / 86400000) : null;
  const kmLeft = r.dueKm != null && odo != null ? r.dueKm - odo : null;
  const hoursLeft = r.dueHours != null && hours != null ? r.dueHours - hours : null;

  const startMs = r.startDate ? new Date(`${r.startDate}T00:00:00`).getTime() : r.createdAt ? new Date(r.createdAt).getTime() : null;
  const progress = {
    km: prog(odo, r.startKm, r.dueKm),
    hours: prog(hours, r.startHours, r.dueHours),
    date: prog(now, startMs, dueMs),
  };
  const values = Object.values(progress).filter((x): x is number => x != null);
  const overall = values.length ? Math.max(...values) : null;

  let status: ReminderStatus = "ok";
  if (r.doneAt) status = "done";
  else if ((daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft < 0) || (hoursLeft != null && hoursLeft < 0)) status = "overdue";
  else if ((daysLeft != null && daysLeft <= SOON.days) || (kmLeft != null && kmLeft <= SOON.km) || (hoursLeft != null && hoursLeft <= SOON.hours)) status = "soon";
  return { status, daysLeft, kmLeft, hoursLeft, progress, overall };
}

export const REMINDER_LABEL: Record<ReminderStatus, string> = {
  done: "Fatto",
  overdue: "Scaduto",
  soon: "In scadenza",
  ok: "In regola",
};
export const REMINDER_COLOR: Record<ReminderStatus, string> = {
  done: "#5b6672",
  overdue: "#c62828",
  soon: "#e8710a",
  ok: "#0a8a4a",
};

/** Aggiunge mesi a una data "YYYY-MM-DD" */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

export const todayIso = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA formatta come YYYY-MM-DD
};

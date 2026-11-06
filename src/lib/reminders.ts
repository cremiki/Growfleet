// Stato di una scadenza (manutenzione o documento) rispetto a data, km e ore motore attuali

export type ReminderLike = {
  dueDate: string | null; // "YYYY-MM-DD"
  dueKm: number | null;
  dueHours: number | null;
  doneAt: Date | string | null;
};

export type ReminderStatus = "done" | "overdue" | "soon" | "ok";

export const SOON = { days: 30, km: 1000, hours: 50 };

export function reminderState(r: ReminderLike, odo: number | null, hours: number | null, now = Date.now()) {
  const daysLeft = r.dueDate ? Math.ceil((new Date(`${r.dueDate}T23:59:59`).getTime() - now) / 86400000) : null;
  const kmLeft = r.dueKm != null && odo != null ? r.dueKm - odo : null;
  const hoursLeft = r.dueHours != null && hours != null ? r.dueHours - hours : null;
  let status: ReminderStatus = "ok";
  if (r.doneAt) status = "done";
  else if ((daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft < 0) || (hoursLeft != null && hoursLeft < 0)) status = "overdue";
  else if ((daysLeft != null && daysLeft <= SOON.days) || (kmLeft != null && kmLeft <= SOON.km) || (hoursLeft != null && hoursLeft <= SOON.hours)) status = "soon";
  return { status, daysLeft, kmLeft, hoursLeft };
}

export const REMINDER_LABEL: Record<ReminderStatus, string> = {
  done: "Fatto",
  overdue: "Scaduto",
  soon: "In scadenza",
  ok: "In regola",
};
export const REMINDER_COLOR: Record<ReminderStatus, string> = {
  done: "#5b6672",
  overdue: "#b3261e",
  soon: "#c98f00",
  ok: "#0a7a45",
};

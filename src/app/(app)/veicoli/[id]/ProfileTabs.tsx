"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { VehicleProfile } from "@/lib/db/schema";
import { REMINDER_COLOR, REMINDER_LABEL, type ReminderStatus } from "@/lib/reminders";
import { fmt1, fmtInt } from "@/lib/format";
import { addReminder, completeReminder, deleteReminder, type FormState } from "../actions";
import { TYPE_LABEL } from "./typeLabels";

type Rem = {
  id: number; kind: "manutenzione" | "documento"; title: string;
  dueDate: string | null; dueKm: number | null; dueHours: number | null; notes: string | null;
  startKm: number | null; intervalKm: number | null; startHours: number | null; intervalHours: number | null;
  startDate: string | null; intervalMonths: number | null;
  done: boolean; status: ReminderStatus; daysLeft: number | null; kmLeft: number | null; hoursLeft: number | null;
  progress: { km: number | null; hours: number | null; date: number | null }; overall: number | null;
};

type Props = { deviceId: number; isAdmin: boolean; profile: VehicleProfile | null; reminders: Rem[]; odometer: number | null; hours: number | null };

export function ProfileTabs({ deviceId, isAdmin, profile, reminders, odometer, hours }: Props) {
  const [tab, setTab] = useState<"spec" | "manutenzione" | "documento">("spec");
  const tabs = [
    ["spec", "Specifica"],
    ["manutenzione", `Promemoria di manutenzione (${reminders.filter((r) => r.kind === "manutenzione" && !r.done).length})`],
    ["documento", `Documenti e scadenze (${reminders.filter((r) => r.kind === "documento" && !r.done).length})`],
  ] as const;
  return (
    <section className="mt-6">
      <div className="flex gap-1 border-b border-line" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-[3px] -mb-px ${tab === k ? "border-sign text-sign" : "border-transparent text-muted hover:text-ink"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="bg-surface border border-t-0 border-line p-5">
        {tab === "spec" ? <Spec p={profile} isAdmin={isAdmin} deviceId={deviceId} />
          : <Reminders kind={tab} deviceId={deviceId} isAdmin={isAdmin} items={reminders.filter((r) => r.kind === tab)} odometer={odometer} hours={hours} />}
      </div>
    </section>
  );
}

function Spec({ p, isAdmin, deviceId }: { p: VehicleProfile | null; isAdmin: boolean; deviceId: number }) {
  if (!p) {
    return (
      <p className="text-muted">
        L&apos;anagrafica di questo veicolo è ancora vuota.
        {isAdmin && <> <a href={`/veicoli/${deviceId}/modifica`} className="text-sign hover:underline">Completa l&apos;anagrafica</a> per mostrare targa, modello e tipo in mappa e nei report.</>}
      </p>
    );
  }
  const rows: [string, string | null][][] = [
    [
      ["Targa", p.plate], ["Marca e modello", [p.make, p.model].filter(Boolean).join(" ") || null],
      ["Tipo", p.type ? TYPE_LABEL[p.type] ?? p.type : null], ["Anno", p.year ? String(p.year) : null],
      ["Numero di telaio (VIN)", p.vin], ["Autista", p.driver], ["Testo dell'etichetta", p.iconText],
    ],
    [
      ["Carburante", p.fuelType], ["Capacità del serbatoio", p.tankL != null ? `${fmtInt(p.tankL)} l` : null],
      ["Consumo medio", p.consumptionL100 != null ? `${fmt1(p.consumptionL100)} l/100km` : null],
      ["Emissioni di CO2", p.co2GKm != null ? `${fmtInt(p.co2GKm)} g/km` : null],
    ],
    [
      ["Limite di velocità", p.speedLimit != null ? `${p.speedLimit} km/h` : null],
      ["Velocità ecologica", p.ecoSpeed != null ? `${p.ecoSpeed} km/h` : null],
      ["Sosta eccessiva oltre", p.longStopMin != null ? `${p.longStopMin} min` : null],
      ["Telefono", p.phone], ["Note", p.notes],
    ],
  ];
  const titles = ["Informazioni sul veicolo", "Informazioni tecniche", "Comportamento di guida e altro"];
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {rows.map((group, i) => (
        <div key={i}>
          <h3 className="text-sm font-semibold text-muted">{titles[i]}</h3>
          <dl className="mt-2 text-[15px]">
            {group.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1 border-b border-line/60">
                <dt className="text-muted">{k}</dt><dd className="text-right whitespace-pre-line">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const dateIt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("it-IT");

function Reminders({ kind, deviceId, isAdmin, items, odometer, hours }: {
  kind: "manutenzione" | "documento"; deviceId: number; isAdmin: boolean; items: Rem[]; odometer: number | null; hours: number | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addReminder, {});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { ref.current?.reset(); setOpen(false); } }, [state]);
  const order = ["overdue", "soon", "ok", "done"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (b.overall ?? 0) - (a.overall ?? 0));
  const isMaint = kind === "manutenzione";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {isMaint ? "Tagliandi, gomme, freni: imposta ogni quanti km, ore motore o mesi e l'avanzamento segue il contachilometri del veicolo."
            : "Assicurazione, bollo, revisione e altri documenti con scadenza."}
          {" "}Diventano gialli entro 30 giorni, 1.000 km o 50 ore dalla scadenza.
        </p>
        {isAdmin && !open && (
          <button type="button" onClick={() => setOpen(true)} className="bg-sign hover:bg-sign-dark text-white rounded px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
            {isMaint ? "Aggiungi manutenzione" : "Aggiungi scadenza"}
          </button>
        )}
      </div>

      {open && (
        <form ref={ref} action={action} className="mt-4 border border-line bg-asphalt/30 p-4 space-y-4">
          <input type="hidden" name="deviceId" value={deviceId} />
          <input type="hidden" name="kind" value={kind} />
          <label className="block text-sm max-w-md">Titolo
            <input name="title" required className="input w-full mt-1" placeholder={isMaint ? "Tagliando" : "Assicurazione RCA"} list={`suggest-${kind}`} />
            <datalist id={`suggest-${kind}`}>
              {(isMaint ? ["Tagliando", "Cambio olio", "Cambio gomme", "Freni", "Distribuzione", "Filtri"] : ["Assicurazione RCA", "Bollo", "Revisione", "Tachigrafo", "Leasing / noleggio"]).map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>

          <fieldset>
            <legend className="text-sm font-semibold">{isMaint ? "Si ripete ogni" : "Si rinnova ogni"}</legend>
            <div className="grid sm:grid-cols-3 gap-3 mt-1">
              {isMaint && <label className="text-sm">km<input name="intervalKm" type="number" min={1} step="1" className="input w-full mt-1" placeholder="es. 15000" /></label>}
              {isMaint && <label className="text-sm">ore motore<input name="intervalHours" type="number" min={1} step="1" className="input w-full mt-1" placeholder="es. 500" /></label>}
              <label className="text-sm">mesi<input name="intervalMonths" type="number" min={1} max={240} step="1" className="input w-full mt-1" placeholder={isMaint ? "es. 12" : "es. 12"} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">{isMaint ? "Ultimo intervento" : "Ultimo rinnovo"}</legend>
            <div className="grid sm:grid-cols-3 gap-3 mt-1">
              {isMaint && (
                <label className="text-sm">a km<input name="startKm" type="number" min={0} step="1" className="input w-full mt-1"
                  defaultValue={odometer != null ? Math.round(odometer) : ""} placeholder="contachilometri" /></label>
              )}
              {isMaint && (
                <label className="text-sm">a ore motore<input name="startHours" type="number" min={0} step="1" className="input w-full mt-1"
                  defaultValue={hours != null ? Math.round(hours) : ""} /></label>
              )}
              <label className="text-sm">il giorno<input name="startDate" type="date" defaultValue={today()} className="input w-full mt-1" /></label>
            </div>
            {isMaint && <p className="text-xs text-muted mt-1">Già compilati con i valori attuali del veicolo: correggili se l&apos;ultimo intervento è stato fatto prima.</p>}
          </fieldset>

          <details className="text-sm">
            <summary className="cursor-pointer text-sign">Oppure indica una scadenza precisa</summary>
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              <label className="text-sm">Entro la data<input name="dueDate" type="date" className="input w-full mt-1" /></label>
              {isMaint && <label className="text-sm">Entro i km<input name="dueKm" type="number" min={0} step="1" className="input w-full mt-1" /></label>}
              {isMaint && <label className="text-sm">Entro le ore<input name="dueHours" type="number" min={0} step="1" className="input w-full mt-1" /></label>}
            </div>
          </details>

          <label className="block text-sm">Note<input name="notes" className="input w-full mt-1" /></label>
          <div className="flex items-center gap-3">
            <button disabled={pending} className="bg-sign hover:bg-sign-dark text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60">Salva</button>
            <button type="button" onClick={() => setOpen(false)} className="border border-line rounded px-3 py-2 text-sm bg-white">Annulla</button>
            {state.error && <p role="alert" className="text-offline text-sm">{state.error}</p>}
          </div>
        </form>
      )}
      {state.ok && !open && <p role="status" className="text-moving text-sm mt-3">{state.ok}</p>}

      {sorted.length === 0 ? (
        <p className="mt-4 text-muted">{isMaint ? "Nessuna manutenzione programmata." : "Nessuna scadenza registrata."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border border-line">
          {sorted.map((r) => <ReminderRow key={r.id} r={r} deviceId={deviceId} isAdmin={isAdmin} odometer={odometer} hours={hours} />)}
        </ul>
      )}
    </div>
  );
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted"><span>{label}</span><span>{Math.round(value * 100)}%</span></div>
      <div className="h-2 bg-asphalt rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ReminderRow({ r, deviceId, isAdmin, odometer, hours }: { r: Rem; deviceId: number; isAdmin: boolean; odometer: number | null; hours: number | null }) {
  const color = REMINDER_COLOR[r.status];
  const every = [r.intervalKm && `${fmtInt(r.intervalKm)} km`, r.intervalHours && `${fmtInt(r.intervalHours)} ore`, r.intervalMonths && `${r.intervalMonths} mesi`].filter(Boolean).join(" o ");
  const left = [
    r.kmLeft != null && (r.kmLeft < 0 ? `superata di ${fmtInt(-r.kmLeft)} km` : `mancano ${fmtInt(r.kmLeft)} km`),
    r.hoursLeft != null && (r.hoursLeft < 0 ? `superata di ${fmtInt(-r.hoursLeft)} ore` : `mancano ${fmtInt(r.hoursLeft)} ore`),
    r.daysLeft != null && (r.daysLeft < 0 ? `scaduta da ${-r.daysLeft} giorni` : `mancano ${r.daysLeft} giorni`),
  ].filter(Boolean).join(", ");
  return (
    <li className={`p-4 grid md:grid-cols-[1fr_minmax(260px,360px)_auto] gap-4 items-start ${r.done ? "opacity-60" : ""}`}>
      <div>
        <p className="font-semibold">
          {r.title} <span className="ml-2 text-xs font-semibold" style={{ color }}>{REMINDER_LABEL[r.status]}</span>
        </p>
        <p className="text-sm text-muted mt-0.5">
          {every ? `Ogni ${every}. ` : ""}
          Scadenza: {[r.dueKm != null && `${fmtInt(r.dueKm)} km`, r.dueHours != null && `${fmtInt(r.dueHours)} ore`, r.dueDate && dateIt(r.dueDate)].filter(Boolean).join(", ")}
        </p>
        {!r.done && left && <p className="text-sm mt-0.5" style={{ color: r.status === "ok" ? undefined : color }}>{left}</p>}
        {r.dueKm != null && odometer == null && !r.done && <p className="text-xs text-muted mt-0.5">Il veicolo non invia il contachilometri: l&apos;avanzamento in km non si può calcolare.</p>}
        {r.notes && <p className="text-sm text-muted mt-1">{r.notes}</p>}
      </div>
      <div className="space-y-2">
        {!r.done && r.progress.km != null && (
          <Bar value={r.progress.km} color={color} label={`${fmtInt(Math.max(0, (odometer ?? 0) - (r.startKm ?? 0)))} di ${fmtInt((r.dueKm ?? 0) - (r.startKm ?? 0))} km`} />
        )}
        {!r.done && r.progress.hours != null && (
          <Bar value={r.progress.hours} color={color} label={`${fmtInt(Math.max(0, (hours ?? 0) - (r.startHours ?? 0)))} di ${fmtInt((r.dueHours ?? 0) - (r.startHours ?? 0))} ore`} />
        )}
        {!r.done && r.progress.date != null && (
          <Bar value={r.progress.date} color={color} label={r.dueDate ? `fino al ${dateIt(r.dueDate)}` : "tempo"} />
        )}
      </div>
      <div className="text-sm whitespace-nowrap">
        {isAdmin && (
          <span className="inline-flex flex-col items-end gap-1.5">
            {!r.done && (
              <form action={completeReminder}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="deviceId" value={deviceId} />
                <button className="text-sign hover:underline" title={every ? "Crea anche la prossima scadenza dai valori attuali" : undefined}>
                  {every ? "Fatto, programma il prossimo" : "Segna come fatto"}
                </button></form>
            )}
            <form action={deleteReminder}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="deviceId" value={deviceId} />
              <button className="text-offline hover:underline">Elimina</button></form>
          </span>
        )}
      </div>
    </li>
  );
}

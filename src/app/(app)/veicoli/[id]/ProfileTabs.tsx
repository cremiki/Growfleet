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
  done: boolean; status: ReminderStatus; daysLeft: number | null; kmLeft: number | null; hoursLeft: number | null;
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

function Reminders({ kind, deviceId, isAdmin, items, odometer, hours }: {
  kind: "manutenzione" | "documento"; deviceId: number; isAdmin: boolean; items: Rem[]; odometer: number | null; hours: number | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addReminder, {});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { ref.current?.reset(); setOpen(false); } }, [state]);
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done) || ["overdue", "soon", "ok", "done"].indexOf(a.status) - ["overdue", "soon", "ok", "done"].indexOf(b.status));
  const isMaint = kind === "manutenzione";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {isMaint ? "Tagliandi, cambio gomme, revisioni dei componenti: avvisa per data, chilometri o ore motore."
            : "Assicurazione, bollo, revisione, patenti e altri documenti con scadenza."}
          {" "}In scadenza: entro {30} giorni, 1.000 km o 50 ore.
        </p>
        {isAdmin && !open && (
          <button type="button" onClick={() => setOpen(true)} className="bg-sign hover:bg-sign-dark text-white rounded px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
            {isMaint ? "Aggiungi promemoria" : "Aggiungi scadenza"}
          </button>
        )}
      </div>

      {open && (
        <form ref={ref} action={action} className="mt-4 border border-line bg-asphalt/30 p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <input type="hidden" name="deviceId" value={deviceId} />
          <input type="hidden" name="kind" value={kind} />
          <label className="text-sm lg:col-span-2">Titolo
            <input name="title" required className="input w-full mt-1" placeholder={isMaint ? "Tagliando" : "Assicurazione RCA"} list={`suggest-${kind}`} />
            <datalist id={`suggest-${kind}`}>
              {(isMaint ? ["Tagliando", "Cambio olio", "Cambio gomme", "Freni", "Distribuzione", "Filtri"] : ["Assicurazione RCA", "Bollo", "Revisione", "Tachigrafo", "Patente autista", "Leasing / noleggio"]).map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>
          <label className="text-sm">Entro la data<input name="dueDate" type="date" className="input w-full mt-1" /></label>
          {isMaint && (
            <>
              <label className="text-sm">Entro i km<input name="dueKm" type="number" min={0} step="1" className="input w-full mt-1" placeholder={odometer != null ? `ora ${fmtInt(odometer)}` : ""} /></label>
              <label className="text-sm">Entro le ore motore<input name="dueHours" type="number" min={0} step="1" className="input w-full mt-1" placeholder={hours != null ? `ora ${fmtInt(hours)}` : ""} /></label>
            </>
          )}
          <label className="text-sm sm:col-span-2 lg:col-span-4">Note<input name="notes" className="input w-full mt-1" /></label>
          <div className="flex gap-2">
            <button disabled={pending} className="bg-sign hover:bg-sign-dark text-white rounded px-4 py-2 text-sm font-semibold disabled:opacity-60">Salva</button>
            <button type="button" onClick={() => setOpen(false)} className="border border-line rounded px-3 py-2 text-sm bg-white">Annulla</button>
          </div>
          {state.error && <p role="alert" className="text-offline text-sm sm:col-span-2 lg:col-span-5">{state.error}</p>}
        </form>
      )}
      {state.ok && !open && <p role="status" className="text-moving text-sm mt-3">{state.ok}</p>}

      {sorted.length === 0 ? (
        <p className="mt-4 text-muted">{isMaint ? "Nessun promemoria." : "Nessuna scadenza registrata."}</p>
      ) : (
        <table className="w-full text-sm mt-4">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Stato</th><th className="py-2 pr-3 font-medium">Titolo</th>
              <th className="py-2 pr-3 font-medium">Scadenza</th><th className="py-2 pr-3 font-medium">Mancano</th>
              <th className="py-2 pr-3 font-medium">Note</th><th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={`border-b border-line/60 align-top ${r.done ? "text-muted" : ""}`}>
                <td className="py-2 pr-3 whitespace-nowrap font-semibold" style={{ color: REMINDER_COLOR[r.status] }}>{REMINDER_LABEL[r.status]}</td>
                <td className="py-2 pr-3 font-medium">{r.title}</td>
                <td className="py-2 pr-3">
                  {[r.dueDate && new Date(`${r.dueDate}T00:00:00`).toLocaleDateString("it-IT"), r.dueKm != null && `${fmtInt(r.dueKm)} km`, r.dueHours != null && `${fmtInt(r.dueHours)} h`].filter(Boolean).join(", ")}
                </td>
                <td className="py-2 pr-3">
                  {r.done ? "—" : [
                    r.daysLeft != null && (r.daysLeft < 0 ? `${-r.daysLeft} giorni fa` : `${r.daysLeft} giorni`),
                    r.kmLeft != null && (r.kmLeft < 0 ? `superato di ${fmtInt(-r.kmLeft)} km` : `${fmtInt(r.kmLeft)} km`),
                    r.hoursLeft != null && (r.hoursLeft < 0 ? `superato di ${fmtInt(-r.hoursLeft)} h` : `${fmtInt(r.hoursLeft)} h`),
                    (r.dueKm != null && r.kmLeft == null) && "km non disponibili",
                  ].filter(Boolean).join(", ")}
                </td>
                <td className="py-2 pr-3 text-muted">{r.notes}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  {isAdmin && (
                    <span className="inline-flex gap-3">
                      {!r.done && (
                        <form action={completeReminder}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="deviceId" value={deviceId} />
                          <button className="text-sign hover:underline">Segna come fatto</button></form>
                      )}
                      <form action={deleteReminder}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="deviceId" value={deviceId} />
                        <button className="text-offline hover:underline">Elimina</button></form>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

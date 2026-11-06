"use client";

import { startTransition, useActionState } from "react";
import type { Driver } from "@/lib/db/schema";
import { assignVehicle, createDriver, updateDriver, type FormState } from "./actions";

/** Invio senza il reset automatico del modulo di React: dopo il salvataggio i campi mostrano ciò che si è salvato */
function submitWith(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}


function Msg({ s }: { s: FormState }) {
  if (s.ok) return <p role="status" className="text-moving text-sm">{s.ok}</p>;
  if (s.error) return <p role="alert" className="text-offline text-sm">{s.error}</p>;
  return null;
}

function Fields({ d, customers }: { d?: Driver | null; customers: { id: number; name: string }[] }) {
  return (
    <>
      <label className="block text-sm font-medium">Nome e cognome<input name="name" defaultValue={d?.name ?? ""} required className="input w-full mt-1" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Telefono<input name="phone" type="tel" defaultValue={d?.phone ?? ""} className="input w-full mt-1" /></label>
        <label className="block text-sm font-medium">Codice / badge<input name="code" defaultValue={d?.code ?? ""} className="input w-full mt-1" placeholder="matricola o iButton" /></label>
      </div>
      <label className="block text-sm font-medium">Email
        <input name="email" type="email" defaultValue={d?.email ?? ""} className="input w-full mt-1" />
        <span className="block text-xs text-muted font-normal mt-1">Servirà per l&apos;account sull&apos;app autista.</span>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm font-medium col-span-3 sm:col-span-1">Patente n.<input name="licenseNumber" defaultValue={d?.licenseNumber ?? ""} className="input w-full mt-1 uppercase" /></label>
        <label className="block text-sm font-medium">Categorie<input name="licenseCategories" defaultValue={d?.licenseCategories ?? ""} className="input w-full mt-1 uppercase" placeholder="B, C, CE" /></label>
        <label className="block text-sm font-medium">Scadenza<input name="licenseExpiry" type="date" defaultValue={d?.licenseExpiry ?? ""} className="input w-full mt-1" /></label>
      </div>
      {customers.length > 0 && (
        <label className="block text-sm font-medium">Cliente
          <select name="customerId" defaultValue={d?.customerId ?? ""} className="input w-full mt-1">
            <option value="">Nessuno (autista del team)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">Note<textarea name="notes" defaultValue={d?.notes ?? ""} rows={2} className="input w-full mt-1" /></label>
    </>
  );
}

export function NewDriverForm({ customers }: { customers: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createDriver, {});
  return (
    <form action={action} className="bg-surface border border-line p-4 space-y-3 self-start">
      <h2 className="font-semibold text-lg">Nuovo autista</h2>
      <Fields customers={customers} />
      <button disabled={pending} className="w-full bg-sign hover:bg-sign-dark text-white font-semibold rounded py-2 disabled:opacity-60">
        {pending ? "Creazione…" : "Crea autista"}
      </button>
      <Msg s={state} />
    </form>
  );
}

export function EditDriverForm({ driver, customers }: { driver: Driver; customers: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateDriver, {});
  return (
    <form onSubmit={submitWith(action)} className="bg-surface border border-line p-5 space-y-3">
      <input type="hidden" name="id" value={driver.id} />
      <Fields d={driver} customers={customers} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={driver.active} />
        Autista attivo
      </label>
      {/* una casella non spuntata non viene inviata: questo campo vuoto la fa leggere come "no" */}
      <input type="hidden" name="active" value="" />
      <div className="flex items-center gap-4 pt-1">
        <button disabled={pending} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-5 py-2 disabled:opacity-60">Salva</button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function AssignForm({ driverId, current, vehicles, active }: {
  driverId: number; current: number | null; vehicles: { id: number; name: string; driver: string | null }[]; active: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(assignVehicle, {});
  return (
    <form onSubmit={submitWith(action)} className="bg-surface border border-line p-5 space-y-3">
      <input type="hidden" name="driverId" value={driverId} />
      <h2 className="font-semibold">Veicolo abbinato</h2>
      <select name="deviceId" defaultValue={current ?? ""} className="input w-full" disabled={!active}>
        <option value="">Nessun veicolo</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>{v.name}{v.driver && v.id !== current ? ` (ora: ${v.driver})` : ""}</option>
        ))}
      </select>
      <p className="text-xs text-muted">Se il veicolo ha già un autista, viene sostituito. Ogni cambio resta nello storico.</p>
      <div className="flex items-center gap-4">
        <button disabled={pending || !active} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-4 py-2 disabled:opacity-60">Abbina</button>
        <Msg s={state} />
      </div>
    </form>
  );
}

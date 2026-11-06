"use client";

import { startTransition, useActionState, useState } from "react";
import type { VehicleProfile } from "@/lib/db/schema";
import { saveVehicle, type FormState } from "../../actions";
import { FUEL_TYPES, TYPE_LABEL } from "../typeLabels";

/** Invio senza il reset automatico del modulo di React: dopo il salvataggio i campi mostrano ciò che si è salvato */
function submitWith(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}


type Props = {
  deviceId: number;
  isAdmin: boolean;
  profile: VehicleProfile | null;
  deviceName: string;
  customers: { id: number; name: string }[];
  assigned: number[];
  drivers: { id: number; name: string }[];
  odometer: { current: number | null; raw: number | null; offset: number | null; by: string | null; at: string | null };
  fuelLevel: number | null;
};

const SECTIONS = [
  ["generale", "Generale"],
  ["tecniche", "Informazioni tecniche"],
  ["guida", "Comportamento di guida"],
  ["altro", "Altro"],
  ["accesso", "Accesso clienti"],
] as const;

export function VehicleForm({ deviceId, isAdmin, profile: p, deviceName, customers, assigned, drivers, odometer, fuelLevel }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVehicle, {});
  const [section, setSection] = useState<(typeof SECTIONS)[number][0]>("generale");
  const show = (s: string) => (section === s ? "" : "hidden");

  return (
    <form onSubmit={submitWith(action)} className="mt-5 bg-surface border border-line grid md:grid-cols-[220px_1fr]">
      <input type="hidden" name="deviceId" value={deviceId} />
      {isAdmin && <input type="hidden" name="accessSection" value="1" />}
      <nav className="border-b md:border-b-0 md:border-r border-line py-2">
        {SECTIONS.filter(([k]) => isAdmin || k !== "accesso").map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSection(k)} aria-current={section === k}
            className={`w-full text-left px-4 py-2 text-sm border-l-4 ${section === k ? "border-l-sign bg-asphalt/50 font-semibold" : "border-l-transparent hover:bg-asphalt/30"}`}>
            {l}
          </button>
        ))}
      </nav>

      <div className="p-5">
        {/* Le sezioni restano nel form anche quando sono nascoste: si salva tutto insieme */}
        <fieldset className={`grid sm:grid-cols-2 gap-4 ${show("generale")}`}>
          <legend className="sr-only">Generale</legend>
          <F label="Targa"><input name="plate" defaultValue={p?.plate ?? ""} className="input w-full uppercase" placeholder="AB 123 CD" /></F>
          <F label="Tipo">
            <select name="type" defaultValue={p?.type ?? ""} className="input w-full">
              <option value="">Non indicato</option>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </F>
          <F label="Marca"><input name="make" defaultValue={p?.make ?? ""} className="input w-full" /></F>
          <F label="Modello"><input name="model" defaultValue={p?.model ?? ""} className="input w-full" /></F>
          <F label="Anno di immatricolazione"><input name="year" type="number" min={1950} max={2100} defaultValue={p?.year ?? ""} className="input w-full" /></F>
          <F label="Numero di telaio (VIN)"><input name="vin" defaultValue={p?.vin ?? ""} className="input w-full uppercase" maxLength={30} /></F>
          <F label="Autista abbinato" hint={drivers.length ? "Gli autisti si gestiscono nella sezione Autisti." : "Nessun autista: creali nella sezione Autisti."}>
            <select name="driverId" defaultValue={p?.driverId ?? ""} className="input w-full">
              <option value="">Nessuno</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="hidden" name="driver" value={p?.driver ?? ""} />
          </F>
          <F label="Testo dell'etichetta sulla mappa" hint={`Se vuoto si usa la targa, o il nome del dispositivo (${deviceName}).`}>
            <input name="iconText" defaultValue={p?.iconText ?? ""} className="input w-full" maxLength={30} />
          </F>
        </fieldset>

        <fieldset className={`grid sm:grid-cols-2 gap-4 ${show("tecniche")}`}>
          <legend className="sr-only">Informazioni tecniche</legend>
          <F label="Tipo di carburante">
            <select name="fuelType" defaultValue={p?.fuelType ?? ""} className="input w-full">
              <option value="">Non indicato</option>
              {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </F>
          <F label="Capacità del serbatoio (litri)"
            hint={fuelLevel != null ? `Il dispositivo invia il livello in % (ora ${Math.round(fuelLevel)}%): con la capienza l'app lo converte in litri.` : "Serve a convertire il livello da % a litri e viceversa."}>
            <input name="tankL" type="number" min={0} step="0.1" defaultValue={p?.tankL ?? ""} className="input w-full" />
          </F>
          <F label="Contachilometri reale (km)"
            hint={odometer.raw == null ? "Il dispositivo non invia il contachilometri."
              : `Scrivi il valore che leggi sul cruscotto: il dispositivo segna ${Math.round(odometer.raw).toLocaleString("it-IT")} km${odometer.offset ? `, correzione attuale ${odometer.offset > 0 ? "+" : ""}${odometer.offset.toLocaleString("it-IT")} km${odometer.by ? ` (impostata da ${odometer.by}${odometer.at ? ` il ${odometer.at}` : ""})` : ""}` : ""}. Lascia vuoto per non correggere.`}>
            <input name="odoReal" type="number" min={0} step="0.1" disabled={odometer.raw == null}
              defaultValue={odometer.offset != null && odometer.current != null ? Math.round(odometer.current * 10) / 10 : ""} className="input w-full" />
          </F>
          <F label="Consumo medio di riferimento (l/100km)" hint="Serve a confrontare i consumi reali con quelli attesi.">
            <input name="consumptionL100" type="number" min={0} step="0.1" defaultValue={p?.consumptionL100 ?? ""} className="input w-full" />
          </F>
          <F label="Emissioni di CO2 (g/km)"><input name="co2GKm" type="number" min={0} step="1" defaultValue={p?.co2GKm ?? ""} className="input w-full" /></F>
        </fieldset>

        <fieldset className={`grid sm:grid-cols-2 gap-4 ${show("guida")}`}>
          <legend className="sr-only">Comportamento di guida</legend>
          <F label="Limite di velocità (km/h)" hint="Usato dal report Eccesso di velocità al posto del limite generale.">
            <input name="speedLimit" type="number" min={5} max={300} defaultValue={p?.speedLimit ?? ""} className="input w-full" />
          </F>
          <F label="Velocità ecologica (km/h)" hint="Velocità oltre la quale la guida non è considerata economica.">
            <input name="ecoSpeed" type="number" min={5} max={300} defaultValue={p?.ecoSpeed ?? ""} className="input w-full" />
          </F>
          <F label="Sosta eccessiva oltre (minuti)" hint="Soste con quadro acceso più lunghe di così vengono segnalate.">
            <input name="longStopMin" type="number" min={1} max={1440} defaultValue={p?.longStopMin ?? ""} className="input w-full" />
          </F>
        </fieldset>

        <fieldset className={`grid gap-4 ${show("altro")}`}>
          <legend className="sr-only">Altro</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="unavailable" defaultChecked={p?.unavailable ?? false} />
            Segna il veicolo come non disponibile (fermo, in officina, venduto…)
          </label>
          <F label="Numero di telefono (SIM o autista)"><input name="phone" type="tel" defaultValue={p?.phone ?? ""} className="input w-full sm:w-80" /></F>
          <F label="Note"><textarea name="notes" defaultValue={p?.notes ?? ""} rows={4} className="input w-full" maxLength={2000} /></F>
        </fieldset>

        {isAdmin && <fieldset className={show("accesso")}>
          <legend className="text-sm text-muted mb-3">Clienti i cui utenti vedono questo veicolo. Il team lo vede sempre.</legend>
          {customers.length === 0 ? <p className="text-muted text-sm">Non ci sono ancora clienti.</p> : (
            <div className="grid sm:grid-cols-2 gap-2">
              {customers.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm border border-line rounded px-3 py-2">
                  <input type="checkbox" name="customer" value={c.id} defaultChecked={assigned.includes(c.id)} />{c.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>}

        <div className="mt-6 pt-4 border-t border-line flex items-center gap-4">
          <button disabled={pending} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-5 py-2 disabled:opacity-60">
            {pending ? "Salvataggio…" : "Salva"}
          </button>
          <a href={`/veicoli/${deviceId}`} className="text-sm text-muted hover:underline">Annulla</a>
          {state.ok && <p role="status" className="text-moving text-sm">{state.ok}</p>}
          {state.error && <p role="alert" className="text-offline text-sm">{state.error}</p>}
        </div>
      </div>
    </form>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

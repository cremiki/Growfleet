"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import type { DeviceSummary } from "@/lib/types";
import { saveAssignments, type FormState } from "../actions";

type Props = { customerId: number; devices: DeviceSummary[]; selected: number[]; owners: Record<number, string[]> };

export function AssignForm({ customerId, devices, selected, owners }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAssignments, {});
  const [checked, setChecked] = useState(() => new Set(selected));
  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return devices.filter((d) =>
      (!s || d.name.toLowerCase().includes(s) || d.ident.includes(s) || String(d.id) === s) &&
      (!onlyFree || checked.has(d.id) || !owners[d.id]));
  }, [devices, q, onlyFree, checked, owners]);

  const toggle = (id: number) => setChecked((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  if (devices.length === 0) {
    return <p className="mt-6 text-muted">Il token flespi non vede nessun dispositivo. Controlla la pagina Collegamento flespi.</p>;
  }

  return (
    // onSubmit manuale: evita il reset automatico del form dopo l'azione, che desincronizzerebbe le spunte
    <form className="mt-6" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => action(fd));
    }}>
      <input type="hidden" name="customerId" value={customerId} />
      {/* i dispositivi selezionati ma nascosti dal filtro restano nel salvataggio */}
      {[...checked].filter((id) => !visible.some((d) => d.id === id)).map((id) => (
        <input key={id} type="hidden" name="device" value={id} />
      ))}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome, IMEI o ID"
          aria-label="Cerca dispositivo" className="flex-1 min-w-56 border border-line rounded-md px-3 py-2 bg-white" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
          Solo non assegnati ad altri clienti
        </label>
      </div>
      <ul className="mt-4 bg-surface border border-line divide-y divide-line">
        {visible.map((d) => (
          <li key={d.id}>
            <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-asphalt/50 cursor-pointer">
              <input type="checkbox" name="device" value={d.id} checked={checked.has(d.id)} onChange={() => toggle(d.id)} className="size-4" />
              <span className="flex-1 min-w-0">
                <span className="plate font-semibold text-[17px] block truncate">{d.name}</span>
                <span className="text-xs text-muted">ID {d.id}{d.ident ? `, IMEI ${d.ident}` : ""}</span>
              </span>
              {owners[d.id] && <span className="text-xs text-muted text-right">Anche di {owners[d.id].join(", ")}</span>}
            </label>
          </li>
        ))}
        {visible.length === 0 && <li className="px-4 py-3 text-muted">Nessun dispositivo corrisponde alla ricerca.</li>}
      </ul>
      <div className="sticky bottom-0 bg-asphalt py-4 flex items-center gap-4">
        <button disabled={pending} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded-md px-5 py-2.5 disabled:opacity-60">
          {pending ? "Salvataggio…" : `Salva assegnazione (${checked.size})`}
        </button>
        {state.ok && <p role="status" className="text-sm text-moving">{state.ok}</p>}
        {state.error && <p role="alert" className="text-sm text-offline">{state.error}</p>}
      </div>
    </form>
  );
}

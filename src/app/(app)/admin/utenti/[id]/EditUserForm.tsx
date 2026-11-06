"use client";

import { useActionState, useState } from "react";
import { updateUser, type FormState } from "../../clienti/actions";

type Props = {
  user: { id: number; name: string; email: string; role: "admin" | "customer"; customerId: number | null; canEdit: boolean };
  customers: { id: number; name: string }[];
  isSelf: boolean;
};

export function EditUserForm({ user, customers, isSelf }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateUser, {});
  const [role, setRole] = useState(user.role);
  return (
    <form action={action} className="mt-5 bg-surface border border-line p-5 space-y-4">
      <input type="hidden" name="id" value={user.id} />
      <label className="block text-sm font-medium">Nome e cognome
        <input name="name" defaultValue={user.name} required className="input w-full mt-1" />
      </label>
      <label className="block text-sm font-medium">Email
        <input name="email" type="email" defaultValue={user.email} required className="input w-full mt-1" />
      </label>
      <label className="block text-sm font-medium">Accesso
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "customer")} className="input w-full mt-1" disabled={isSelf}>
          <option value="customer">Utente di un cliente</option>
          <option value="admin">Team (vede tutti i clienti)</option>
        </select>
        {isSelf && <input type="hidden" name="role" value="admin" />}
      </label>
      {role === "customer" && (
        <label className="block text-sm font-medium">Cliente
          <select name="customerId" defaultValue={user.customerId ?? ""} required className="input w-full mt-1">
            <option value="" disabled>Scegli…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      {role === "customer" && (
        <fieldset className="text-sm">
          <legend className="font-medium">Permessi</legend>
          <label className="flex items-start gap-2 mt-1.5">
            <input type="radio" name="canEdit" value="1" defaultChecked={user.canEdit} className="mt-1" />
            <span><b className="font-medium">Gestore flotta</b>: modifica profilo dei veicoli, manutenzioni, scadenze e autisti del suo cliente</span>
          </label>
          <label className="flex items-start gap-2 mt-1">
            <input type="radio" name="canEdit" value="0" defaultChecked={!user.canEdit} className="mt-1" />
            <span><b className="font-medium">Sola consultazione</b>: vede mappa, veicoli e report ma non modifica nulla</span>
          </label>
        </fieldset>
      )}
      <label className="block text-sm font-medium">Nuova password
        <input name="password" type="text" minLength={8} autoComplete="new-password" className="input w-full mt-1" placeholder="Lascia vuoto per non cambiarla" />
        <span className="block text-xs text-muted mt-1 font-normal">Comunica la nuova password all&apos;utente: potrà cambiarla da &laquo;Il mio account&raquo;.</span>
      </label>
      <div className="flex items-center gap-4 pt-2">
        <button disabled={pending} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-5 py-2 disabled:opacity-60">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        {state.ok && <p role="status" className="text-moving text-sm">{state.ok}</p>}
        {state.error && <p role="alert" className="text-offline text-sm">{state.error}</p>}
      </div>
    </form>
  );
}

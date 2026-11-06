"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCustomer, createUser, type FormState } from "./actions";

const input = "mt-1 w-full border border-line rounded-md px-3 py-2 bg-white";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-sm text-offline">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-moving">{state.ok}</p>;
  return null;
}

function useResetOnOk(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return ref;
}

export function CustomerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCustomer, {});
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="bg-surface border border-line rounded-md p-4 space-y-3">
      <h2 className="font-semibold text-lg">Nuovo cliente</h2>
      <label className="block text-sm font-medium">Nome
        <input name="name" required className={input} placeholder="Ragione sociale" />
      </label>
      <Feedback state={state} />
      <button disabled={pending} className="w-full bg-sign hover:bg-sign-dark text-white font-semibold rounded-md py-2 disabled:opacity-60">
        {pending ? "Creazione…" : "Crea cliente"}
      </button>
    </form>
  );
}

export function UserForm({ customers }: { customers: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  const [role, setRole] = useState<"customer" | "admin">("customer");
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="bg-surface border border-line rounded-md p-4 space-y-3">
      <h2 className="font-semibold text-lg">Nuovo utente</h2>
      <label className="block text-sm font-medium">Nome e cognome<input name="name" required className={input} /></label>
      <label className="block text-sm font-medium">Email<input name="email" type="email" required className={input} /></label>
      <label className="block text-sm font-medium">Password iniziale
        <input name="password" type="text" minLength={8} required className={input} autoComplete="new-password" />
      </label>
      <label className="block text-sm font-medium">Accesso
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as "customer" | "admin")} className={input}>
          <option value="customer">Utente di un cliente</option>
          <option value="admin">Team (vede tutti i clienti)</option>
        </select>
      </label>
      {role === "customer" && (
        <label className="block text-sm font-medium">Cliente
          <select name="customerId" required className={input} defaultValue="">
            <option value="" disabled>Scegli…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      {role === "customer" && (
        <label className="block text-sm font-medium">Permessi
          <select name="canEdit" className={input} defaultValue="1">
            <option value="1">Gestore flotta (modifica veicoli, manutenzioni, autisti)</option>
            <option value="0">Sola consultazione</option>
          </select>
        </label>
      )}
      <Feedback state={state} />
      <button disabled={pending} className="w-full bg-sign hover:bg-sign-dark text-white font-semibold rounded-md py-2 disabled:opacity-60">
        {pending ? "Creazione…" : "Crea utente"}
      </button>
    </form>
  );
}

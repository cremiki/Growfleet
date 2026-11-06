"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, updateName, type FormState } from "./actions";

function Msg({ s }: { s: FormState }) {
  if (s.ok) return <p role="status" className="text-moving text-sm">{s.ok}</p>;
  if (s.error) return <p role="alert" className="text-offline text-sm">{s.error}</p>;
  return null;
}

export function AccountForms({ name }: { name: string }) {
  const [nameState, nameAction, namePending] = useActionState<FormState, FormData>(updateName, {});
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(changePassword, {});
  const pwRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (pwState.ok) pwRef.current?.reset(); }, [pwState]);

  return (
    <div className="space-y-6 mt-5">
      <form action={nameAction} className="bg-surface border border-line p-5 space-y-3">
        <h2 className="font-semibold">Nome</h2>
        <input name="name" defaultValue={name} required className="input w-full" aria-label="Nome e cognome" />
        <div className="flex items-center gap-4">
          <button disabled={namePending} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-4 py-2 disabled:opacity-60">Salva nome</button>
          <Msg s={nameState} />
        </div>
      </form>

      <form ref={pwRef} action={pwAction} className="bg-surface border border-line p-5 space-y-3">
        <h2 className="font-semibold">Cambia password</h2>
        <label className="block text-sm">Password attuale<input name="current" type="password" autoComplete="current-password" required className="input w-full mt-1" /></label>
        <label className="block text-sm">Nuova password<input name="next" type="password" autoComplete="new-password" minLength={8} required className="input w-full mt-1" /></label>
        <label className="block text-sm">Ripeti la nuova password<input name="repeat" type="password" autoComplete="new-password" minLength={8} required className="input w-full mt-1" /></label>
        <div className="flex items-center gap-4">
          <button disabled={pwPending} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-4 py-2 disabled:opacity-60">Cambia password</button>
          <Msg s={pwState} />
        </div>
      </form>
    </div>
  );
}

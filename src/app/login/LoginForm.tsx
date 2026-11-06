"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" autoComplete="username" required
          className="mt-1 w-full border border-line rounded-md px-3 py-2.5 bg-white focus:border-sign outline-none" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full border border-line rounded-md px-3 py-2.5 bg-white focus:border-sign outline-none" />
      </label>
      {state.error && <p role="alert" className="text-offline text-sm">{state.error}</p>}
      <button disabled={pending}
        className="w-full bg-sign hover:bg-sign-dark text-white font-semibold rounded-md py-2.5 disabled:opacity-60">
        {pending ? "Accesso in corso…" : "Accedi"}
      </button>
    </form>
  );
}

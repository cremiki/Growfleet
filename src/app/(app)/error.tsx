"use client";

import { useEffect } from "react";

/** Se una pagina va in errore nel browser, si vede questo messaggio invece di una pagina bianca */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md bg-surface border border-line p-6">
        <h1 className="text-lg font-semibold">Questa pagina non si è caricata</h1>
        <p className="text-muted mt-2">
          Si è verificato un errore nel browser. Riprova; se succede ancora, ricarica la pagina e segnalaci cosa stavi facendo.
        </p>
        {error.digest && <p className="text-xs text-muted mt-2">Codice: {error.digest}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={reset} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-4 py-2">Riprova</button>
          <button type="button" onClick={() => window.location.reload()} className="border border-line rounded px-4 py-2">Ricarica la pagina</button>
        </div>
      </div>
    </div>
  );
}

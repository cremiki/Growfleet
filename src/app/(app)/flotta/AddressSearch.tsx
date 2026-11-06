"use client";

import { useState } from "react";

type Result = { label: string; lat: number; lon: number };

/** "Cerca indirizzo" sulla mappa (OpenStreetMap) */
export function AddressSearch({ onPick }: { onPick: (r: Result) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setResults(b.results);
    } catch (err) {
      setError((err as Error).message || "Ricerca non riuscita.");
      setResults(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-64">
      <form onSubmit={run} className="flex bg-white border border-line rounded shadow-sm">
        <input value={q} onChange={(e) => { setQ(e.target.value); setResults(null); }} placeholder="Cerca indirizzo"
          aria-label="Cerca indirizzo" className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-l outline-none" />
        <button className="px-2 text-muted hover:text-ink" aria-label="Cerca" disabled={busy}>
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.8" /></svg>
        </button>
      </form>
      {(results || error) && (
        <ul className="mt-1 bg-white border border-line rounded shadow-lg text-sm max-h-72 overflow-y-auto">
          {error && <li className="px-3 py-2 text-offline">{error}</li>}
          {results?.length === 0 && <li className="px-3 py-2 text-muted">Nessun indirizzo trovato.</li>}
          {results?.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => { onPick(r); setResults(null); }} className="w-full text-left px-3 py-2 hover:bg-asphalt">
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

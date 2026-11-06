"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReportDef } from "@/lib/reports/catalog";

const FAV_KEY = "fleet.reportFavorites";

export function useFavorites(): [string[], (id: string) => void] {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { /* storage non disponibile */ }
  }, []);
  const toggle = (id: string) => setFavs((f) => {
    const n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
    try { localStorage.setItem(FAV_KEY, JSON.stringify(n)); } catch { /* ignora */ }
    return n;
  });
  return [favs, toggle];
}

export function ReportCatalog({ categories, reports }: { categories: { id: string; title: string }[]; reports: ReportDef[] }) {
  const [favs, toggleFav] = useFavorites();
  const [active, setActive] = useState<string>("itinerari");
  const [q, setQ] = useState("");

  useEffect(() => { if (favs.length && active === "itinerari" && !q) setActive("preferiti"); }, [favs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s) return reports.filter((r) => r.title.toLowerCase().includes(s) || r.description.toLowerCase().includes(s));
    if (active === "preferiti") return reports.filter((r) => favs.includes(r.id));
    return reports.filter((r) => r.category === active);
  }, [q, active, favs, reports]);

  const cats = [{ id: "preferiti", title: "Preferiti" }, ...categories];
  const count = (id: string) => (id === "preferiti" ? favs.length : reports.filter((r) => r.category === id).length);
  const ready = (id: string) => reports.filter((r) => r.category === id && r.ready).length;
  const heading = q ? `Risultati per “${q}”` : cats.find((c) => c.id === active)?.title;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <h1 className="text-2xl font-semibold">Report</h1>
        <div className="mt-4 grid md:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-surface border border-line self-start">
            <div className="p-3 border-b border-line">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un report" aria-label="Cerca un report"
                className="w-full border border-line rounded px-3 py-1.5 text-sm" />
            </div>
            <nav>
              {cats.map((c) => (
                <button key={c.id} type="button" onClick={() => { setActive(c.id); setQ(""); }}
                  className={`w-full text-left px-4 py-2.5 border-b border-line last:border-0 border-l-4 ${active === c.id && !q ? "border-l-sign bg-asphalt/50" : "border-l-transparent hover:bg-asphalt/40"}`}>
                  <span className="block font-medium text-[15px]">{c.title}</span>
                  <span className="text-xs text-muted">
                    {c.id === "preferiti" ? `${count(c.id)} report` : `${count(c.id)} report, ${ready(c.id)} disponibili`}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          <section>
            <h2 className="text-xl font-semibold">{heading}</h2>
            {shown.length === 0 && (
              <p className="mt-3 text-muted">
                {active === "preferiti" && !q ? "Nessun preferito: premi la stella su un report per trovarlo qui." : "Nessun report trovato."}
              </p>
            )}
            <ul className="mt-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {shown.map((r) => (
                <li key={r.id} className={`relative bg-surface border border-line rounded ${r.ready ? "hover:border-sign" : "opacity-70"}`}>
                  {r.ready ? (
                    <Link href={`/report/${r.id}`} className="block p-3.5 pr-10">
                      <span className="block font-semibold">{r.title}</span>
                      <span className="block text-sm text-muted mt-1 line-clamp-2">{r.description}</span>
                    </Link>
                  ) : (
                    <div className="p-3.5 pr-10" title={r.needs}>
                      <span className="block font-semibold">{r.title} <span className="ml-1 text-[11px] font-semibold bg-asphalt text-muted rounded px-1.5 py-0.5 align-middle">In arrivo</span></span>
                      <span className="block text-sm text-muted mt-1 line-clamp-2">{r.description}</span>
                      {r.needs && <span className="block text-xs text-muted mt-1.5 italic">{r.needs}</span>}
                    </div>
                  )}
                  <button type="button" onClick={() => toggleFav(r.id)} aria-pressed={favs.includes(r.id)}
                    aria-label={favs.includes(r.id) ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
                    className="absolute top-2.5 right-2.5 p-1 text-lg leading-none" style={{ color: favs.includes(r.id) ? "#e0a100" : "#b8c1ca" }}>
                    ★
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

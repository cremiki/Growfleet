"use client";

import { useEffect, useRef, useState } from "react";

type Opt = { value: string | number; label: string; color?: string };

/** Menu a tendina con selezione multipla, come i filtri Gruppi / Stato */
export function Dropdown({ label, options, selected, onChange }: {
  label: string; options: Opt[]; selected: (string | number)[]; onChange: (v: (string | number)[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const toggle = (v: string | number) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className={`flex items-center gap-1.5 border rounded px-2.5 py-1.5 text-[15px] bg-white ${selected.length ? "border-sign text-sign font-medium" : "border-line"}`}>
        {label}{selected.length ? ` (${selected.length})` : ""}
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
      </button>
      {open && (
        <div className="absolute z-[1500] mt-1 min-w-56 bg-white border border-line rounded shadow-lg py-1">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-asphalt cursor-pointer">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.color && <span className="size-2.5 rounded-sm" style={{ background: o.color }} />}
              {o.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full text-left px-3 py-1.5 text-sm text-sign border-t border-line mt-1">
              Azzera filtro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

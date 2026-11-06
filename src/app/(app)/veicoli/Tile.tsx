/** Riquadro con un numero grande, come quelli della pagina Flotta */
export function Tile({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "warn" | "bad" }) {
  const color = tone === "bad" ? "text-offline" : tone === "warn" ? "text-idle" : "text-ink";
  return (
    <div className="bg-surface border border-line px-4 py-3">
      <p className="text-sm text-muted">{title}</p>
      <p className={`plate text-3xl font-semibold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

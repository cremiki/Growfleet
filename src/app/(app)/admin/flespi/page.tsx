import { requireAdmin } from "@/lib/auth/session";
import { fleet } from "@/lib/flespi";
import { METRICS, type CheckStatus } from "@/lib/flespi/diagnose";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<CheckStatus, { label: string; color: string }> = {
  ok: { label: "OK", color: "#0a7a45" },
  warn: { label: "Da verificare", color: "#c98f00" },
  fail: { label: "Errore", color: "#b3261e" },
  skip: { label: "Non provato", color: "#5b6672" },
};

/** Campi del token da non mostrare mai (la chiave stessa) */
const HIDDEN = new Set(["key", "token"]);

export default async function FlespiPage() {
  await requireAdmin();
  const d = await fleet.diagnose();
  const info = d.tokenInfo ? Object.fromEntries(Object.entries(d.tokenInfo).filter(([k]) => !HIDDEN.has(k))) : null;
  const expire = typeof info?.expire === "number" && info.expire > 0 ? fmtDateTime(info.expire) : null;
  const ttl = typeof info?.ttl === "number" && info.ttl > 0 ? Math.round(info.ttl / 86400) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        <section>
          <h1 className="plate text-3xl font-bold">Collegamento flespi</h1>
          <p className="text-muted mt-1">Verifica del token configurato in FLESPI_TOKEN e dei dati che i tuoi dispositivi inviano. Ricarica la pagina dopo ogni modifica.</p>
          <ul className="mt-5 bg-surface border border-line divide-y divide-line">
            {d.checks.map((c) => (
              <li key={c.title} className="flex gap-4 px-4 py-3">
                <span className="shrink-0 w-28 text-sm font-semibold" style={{ color: STATUS[c.status].color }}>
                  <span className="inline-block size-2.5 rounded-full mr-2 align-middle" style={{ background: STATUS[c.status].color }} />
                  {STATUS[c.status].label}
                </span>
                <span>
                  <span className="font-semibold block">{c.title}</span>
                  <span className="text-muted text-[15px]">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {info && (
            <div className="mt-4 text-sm text-muted space-y-1">
              {typeof info.info === "string" && info.info && <p>Nome del token: <span className="text-ink font-medium">{info.info}</span></p>}
              <p>Scadenza: <span className="text-ink font-medium">
                {expire ? `il ${expire}` : ttl ? `dopo ${ttl} giorni senza utilizzo` : "non indicata"}
              </span></p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sign">Configurazione completa del token</summary>
                <pre className="mt-2 bg-surface border border-line p-3 text-xs overflow-x-auto">{JSON.stringify(info, null, 2)}</pre>
              </details>
            </div>
          )}
        </section>

        {d.devices.length > 0 && (
          <section>
            <h2 className="plate text-2xl font-bold">Parametri letti dai dispositivi</h2>
            <p className="text-muted mt-1">
              Per ogni dato mostrato nell&apos;app, il parametro flespi da cui viene letto. Un trattino vuol dire che il dispositivo non lo invia
              oppure lo chiama in un altro modo: in quel caso guarda la colonna &laquo;Altri parametri utili&raquo; e indicami il nome giusto.
            </p>
            <div className="mt-4 overflow-x-auto bg-surface border border-line">
              <table className="text-sm min-w-full">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="p-2.5 font-medium">Dispositivo</th>
                    {METRICS.map((m) => <th key={m.key} className="p-2.5 font-medium whitespace-nowrap">{m.label}</th>)}
                    <th className="p-2.5 font-medium">Altri parametri utili</th>
                  </tr>
                </thead>
                <tbody>
                  {d.devices.map((dev) => (
                    <tr key={dev.id} className="border-b border-line last:border-0 align-top">
                      <td className="p-2.5">
                        <span className="font-semibold block whitespace-nowrap">{dev.name}</span>
                        <span className="text-xs text-muted">ID {dev.id}, {dev.paramCount} parametri</span>
                        {dev.messagesTtl === 0 && <span className="block text-xs text-offline">Messaggi non conservati</span>}
                      </td>
                      {METRICS.map((m) => (
                        <td key={m.key} className="p-2.5 whitespace-nowrap">
                          {dev.found[m.key] ? <span className="text-moving">{dev.found[m.key]}</span> : <span className="text-muted">—</span>}
                        </td>
                      ))}
                      <td className="p-2.5 text-xs text-muted">{dev.candidates.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="plate text-2xl font-bold">Il token consigliato</h2>
          <p className="text-muted mt-1">Un unico token ACL in sola lettura: l&apos;app legge dispositivi, telemetria e messaggi, ma non può modificare nulla in flespi.</p>
          <ol className="mt-4 list-decimal pl-5 space-y-2 leading-relaxed">
            <li>In flespi.io apri <b>Tokens</b> nel menu a sinistra e premi <b>+</b> in basso a destra (se propone dei modelli, chiudi la finestra).</li>
            <li>In <b>info</b> scrivi un nome riconoscibile, per esempio <i>Growfleet sola lettura</i>.</li>
            <li>Come tipo di accesso scegli <b>ACL</b>.</li>
            <li>Aggiungi una regola: modulo <b>gw</b>, oggetto <b>devices</b>, ID <b>all</b>, metodo solo <b>GET</b>, nessun sottomodulo selezionato (così valgono tutti: telemetria, messaggi e gli altri).</li>
            <li>Scadenza: imposta <b>TTL</b> a 31536000 secondi (un anno dall&apos;ultimo utilizzo). L&apos;app lo usa di continuo, quindi non scade finché la piattaforma è attiva.</li>
            <li>Salva, copia il token e incollalo nella variabile <b>FLESPI_TOKEN</b> di Vercel (Settings, Environment Variables), poi ripubblica.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

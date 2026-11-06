import { requireSession } from "@/lib/auth/session";
import { STATUS_COLOR } from "@/lib/format";
import { STATUS_LABEL, type VehicleStatus } from "@/lib/types";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "";

export default async function HelpPage() {
  const s = await requireSession();
  const mail = SUPPORT_EMAIL
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Segnalazione Growfleet")}&body=${encodeURIComponent(`Utente: ${s.email}\nPagina o veicolo:\nCosa stavi facendo:\nCosa è successo:\n`)}`
    : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-3xl">
        <h1 className="text-2xl font-semibold">Aiuto</h1>

        <section className="mt-4 bg-surface border border-line p-5">
          <h2 className="font-semibold text-lg">Segnala un problema</h2>
          <p className="text-muted mt-1">Scrivici cosa stavi facendo e cosa è successo: ci aiuta a risolvere prima.</p>
          <div className="mt-3 flex flex-wrap gap-6">
            {mail ? <a href={mail} className="bg-sign hover:bg-sign-dark text-white font-semibold rounded px-4 py-2">Scrivi al supporto</a> : null}
            {SUPPORT_PHONE && <p><span className="text-muted">Telefono</span><br /><a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`} className="font-semibold text-sign">{SUPPORT_PHONE}</a></p>}
            {SUPPORT_EMAIL && <p><span className="text-muted">Email</span><br /><a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-sign">{SUPPORT_EMAIL}</a></p>}
            {!SUPPORT_EMAIL && !SUPPORT_PHONE && <p className="text-muted text-sm">Contatti del supporto non ancora configurati (variabili SUPPORT_EMAIL e SUPPORT_PHONE).</p>}
          </div>
        </section>

        <section className="mt-6 space-y-5 leading-relaxed">
          <Guide title="I colori dei veicoli">
            <ul className="space-y-1.5">
              {(["moving", "idle", "stopped", "offline", "nodata"] as VehicleStatus[]).map((st) => (
                <li key={st} className="flex items-center gap-2">
                  <span className="size-3.5 rounded-sm" style={{ background: STATUS_COLOR[st] }} />
                  <span className="font-medium">{STATUS_LABEL[st]}</span>
                  <span className="text-muted">{EXPLAIN[st]}</span>
                </li>
              ))}
            </ul>
          </Guide>
          <Guide title="Live map">
            Clicca un veicolo nell&apos;elenco o sulla mappa per aprire la scheda <b>Adesso</b>: stato e da quanto dura, posizione, contachilometri,
            riepilogo di oggi e carburante. Con <b>Gruppi</b> e <b>Stato</b> filtri l&apos;elenco; <b>Mostra tutti</b> riporta la mappa sull&apos;intera flotta.
          </Guide>
          <Guide title="Itinerari di un giorno">
            Nella scheda <b>Itinerari</b> scegli il giorno con il calendario o le frecce. Le soste sono numerate in blu, i tragitti in verde:
            cliccando una voce la mappa la mette in evidenza. Una sosta conta come tale solo se dura almeno 5 minuti.
          </Guide>
          <Guide title="Report">
            Scegli un report dal catalogo, poi veicoli e periodo (fino a 31 giorni) e premi <b>Genera report</b>. Con <b>Colonne</b> scegli cosa vedere,
            con <b>Excel (CSV)</b> scarichi i dati e con <b>Stampa / PDF</b> ottieni un documento. La stella aggiunge il report ai preferiti.
          </Guide>
          <Guide title="Flotta, manutenzione e scadenze">
            Nella pagina <b>Flotta</b> trovi tutti i veicoli e i totali del mese. Nel profilo di un veicolo ci sono l&apos;anagrafica, i promemoria di
            manutenzione (per data, km o ore motore) e le scadenze dei documenti: diventano gialli 30 giorni, 1.000 km o 50 ore prima e rossi quando sono superati.
          </Guide>
          <Guide title="Indirizzi">
            Gli indirizzi vengono da OpenStreetMap e compaiono uno al secondo; quelli già trovati restano salvati. Nel frattempo si vedono le coordinate.
          </Guide>
          <Guide title="Problemi frequenti">
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Non raggiungibile</b>: il dispositivo non manda dati da più di 30 minuti (veicolo in garage sotterraneo, batteria staccata, SIM scaduta).</li>
              <li><b>Nessuna posizione</b>: il dispositivo è registrato ma non ha mai inviato un fix GPS.</li>
              <li><b>Itinerari vuoti</b>: il dispositivo non ha inviato posizioni in quel giorno, oppure i suoi messaggi non vengono conservati.</li>
              <li><b>Carburante o contachilometri mancanti</b>: non tutti i dispositivi li leggono dal veicolo; segnalacelo indicando il veicolo.</li>
            </ul>
          </Guide>
        </section>
      </div>
    </div>
  );
}

const EXPLAIN: Record<VehicleStatus, string> = {
  moving: "si sta muovendo",
  idle: "fermo ma con il quadro acceso",
  stopped: "fermo e spento",
  offline: "nessun dato da oltre 30 minuti",
  nodata: "il dispositivo non ha mai inviato una posizione",
};

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold text-lg">{title}</h2>
      <div className="mt-1 text-[15px]">{children}</div>
    </div>
  );
}

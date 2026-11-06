# Flotta: frontend di tracking su flespi

Next.js 15 (App Router) + TypeScript. Il browser non parla mai direttamente con flespi: tutte le chiamate passano dal server dell'app, che custodisce il token.

```
Browser ──► Next.js (API /api/*, login, sessione) ──► flespi REST (flespi.io/gw/...)
                │
                └─► Postgres (utenti, clienti; in futuro storico dati)
```

## Funzioni della prima versione

- **Login separato** per il team (admin) e per gli utenti dei clienti.
- **Multi-cliente con un solo account flespi**: i veicoli si assegnano ai clienti dal pannello admin (tabella `customer_devices`). Il server chiede a flespi solo i dispositivi assegnati al cliente e rifiuta qualsiasi altro ID, quindi un cliente non può vedere i veicoli degli altri nemmeno chiamando le API a mano.
- **Elenco veicoli** con ricerca e filtro per stato (in marcia, fermo con quadro acceso, spento, non raggiungibile).
- **Stato del veicolo**: quadro, velocità, carburante, contachilometri, ore motore, alimentazione, satelliti, più l'elenco completo dei parametri del dispositivo.
- **Mappa live** con OpenStreetMap (gratis) o Google Maps (con chiave), aggiornata ogni 10 secondi.
- **Pannello veicolo** con le schede *Adesso* (stato e da quanto, indirizzo, contachilometri CAN/GPS, riepilogo di oggi, carburante, altri dati) e *Itinerari* (giorno per giorno: soste numerate con indirizzo, tragitti, riepilogo e percorso sulla mappa). Indirizzi da OpenStreetMap con cache nel database.
- **Report**: catalogo per categorie con ricerca e preferiti; ogni report ha scelta di veicoli, periodo e fascia oraria, tabella raggruppata con totali, scelta delle colonne, esportazione Excel (CSV) e stampa/PDF. Disponibili: Itinerari, Rapporto mensile (km), Report mensile (ore), Ore lavorative (chiave on), Mensile GPS e CAN, Fermate, Coordinate, Posizionamento flotta, Tensione di alimentazione, Riepilogo per veicoli, Riepilogo per giorni, Eccesso di velocità. Gli altri sono nel catalogo come "In arrivo", con il motivo.
- **Flotta e manutenzione**: elenco dei veicoli con totali del mese (km, ore motore, carburante dai contatori del veicolo) e profilo di ogni veicolo con anagrafica (targa, marca e modello, tipo, autista, carburante, serbatoio, consumo di riferimento, limiti di guida), promemoria di manutenzione per data, km o ore motore e scadenze dei documenti. Targa, tipo ed etichetta vengono usati in mappa e report; il limite di velocità del veicolo nel report Eccesso di velocità.
- **Mappa**: colori per stato (verde acceso e in movimento, arancio acceso fermo, rosso spento, grigio non raggiungibile); passando il mouse sul veicolo compare una scheda con stato, velocità, autista, carburante e ultimo dato; box per cercare un indirizzo e vedere i veicoli più vicini (in linea d'aria).
- **Carburante e contachilometri**: con la capienza del serbatoio nel profilo l'app converte la % in litri (e viceversa); il contachilometri si può correggere inserendo il valore reale del cruscotto (la correzione vale anche per itinerari, report e manutenzioni).
- **Manutenzioni a intervalli**: "ogni X km / ore / mesi" dall'ultimo intervento, barra di avanzamento che segue il contachilometri, rinnovo automatico quando si segna come fatta.
- **Autisti**: anagrafica (telefono, codice/badge, patente con scadenza, cliente), abbinamento al veicolo con storico; predisposti per l'account sull'app autista (`drivers.user_id`, origine abbinamento `manuale | app | badge`).
- **Gestione in mano al cliente**: gli utenti di un cliente modificano da soli profilo dei veicoli (serbatoio, contachilometri, limiti…), manutenzioni, scadenze e autisti, solo sui propri veicoli e con i propri autisti. Ogni utente cliente è *Gestore flotta* (predefinito) o *Sola consultazione*, impostabile da Clienti e utenti. Restano al team: clienti, utenti, assegnazione dei dispositivi e collegamento flespi. La correzione del contachilometri registra chi l'ha fatta e quando.
- **Utenti**: modifica, blocco (effetto immediato), reimpostazione password, ultimo accesso; ogni utente cambia nome e password da *Il mio account*.
- **Aiuto**: contatti del supporto (`SUPPORT_EMAIL`, `SUPPORT_PHONE`) e guida rapida.
- **Pannello admin**: clienti, utenti e assegnazione dei veicoli; pagina *Collegamento flespi* che verifica il token, i permessi, la conservazione dei messaggi e quali parametri inviano i dispositivi.
- **Modalità demo**: senza `FLESPI_TOKEN` l'app parte con 9 veicoli simulati.

## Avvio in locale

```bash
npm install
cp .env.example .env.local      # poi compila i valori
npm run dev                      # http://localhost:3000
```

Senza `DATABASE_URL` usa un Postgres embedded (PGlite) salvato in `.data/`. Senza `FLESPI_TOKEN` parte in demo: accedi con `admin@demo.it` / `demo1234` (team) o `cliente@demo.it` / `demo1234` (cliente).

Con dati reali imposta `FLESPI_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `AUTH_SECRET`: al primo avvio viene creato l'amministratore.

## Collegare flespi

Serve **un solo token, di tipo ACL e in sola lettura**: niente token Master e niente subaccount.

1. In flespi.io: *Tokens* › **+**, tipo **ACL**, una regola su `gw/devices` con ID **all**, metodo solo **GET**, nessun sottomodulo selezionato (valgono tutti: telemetria, messaggi…). Scadenza: **TTL 31536000** (un anno dall'ultimo utilizzo; l'app lo usa di continuo).
2. Metti il token in `FLESPI_TOKEN` (su Vercel: Settings › Environment Variables) e ripubblica.
3. Apri **Collegamento flespi** nell'app: verifica che il token sia valido, che non sia Master, che legga dispositivi, telemetria e messaggi, e mostra per ogni dispositivo da quale parametro arrivano carburante, contachilometri, ecc.
4. Se un dato manca, aggiungi il nome del parametro in `PARAMS` dentro `src/lib/flespi/normalize.ts` (la pagina suggerisce i parametri candidati).
5. I dispositivi devono avere `messages_ttl` > 0, altrimenti lo storico percorsi resta vuoto (la pagina lo segnala).

Quando servirà inviare comandi ai veicoli basterà aggiungere al token il metodo POST sul sottomodulo dei comandi.

> Account flespi Free: ha limiti sul numero di chiamate API. L'app fa una chiamata ogni 10 secondi per ogni scheda aperta sulla mappa (con una cache di 3 secondi sul server). Se serve, alza `NEXT_PUBLIC_LIVE_REFRESH_SECONDS`.

## Deploy di test su Vercel

1. Pubblica il progetto su un repository GitHub e importalo in Vercel.
2. Aggiungi un database Postgres dal Marketplace di Vercel (es. Neon): imposta automaticamente `DATABASE_URL`. **Senza database su Vercel utenti, clienti e assegnazioni dei veicoli si perdono a ogni riavvio.**
3. Imposta le variabili: `FLESPI_TOKEN`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e, se vuoi Google, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (+ `NEXT_PUBLIC_GOOGLE_MAP_ID`).

## Passaggio alla VPS

La build usa `output: "standalone"`, quindi gira come normale processo Node:

```bash
npm ci && npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ 2>/dev/null || true
node .next/standalone/server.js        # PORT=3000 di default; mettilo dietro nginx/Caddy con HTTPS
```

Oppure con Docker: `docker build -t flotta . && docker run -p 3000:3000 --env-file .env flotta`.

## Prossimi passi consigliati

- **Report su periodi lunghi**: oggi i report leggono i messaggi grezzi da flespi (massimo 31 giorni). Con molti veicoli o per report annuali conviene salvare sulla VPS un riepilogo giornaliero per veicolo (km, ore, carburante) e leggere da lì.

- **Storico proprio** (dati che flespi non conserva o conserva poco): sulla VPS, un servizio sempre attivo che riceve i messaggi da flespi con uno *stream HTTP* o un abbonamento MQTT a `flespi/message/gw/devices/+`, e li salva in Postgres + TimescaleDB. Lo storico percorsi può poi leggere da lì invece che da flespi.
- **Live via MQTT** sulla VPS: il server si abbona a `flespi/state/gw/devices/+/telemetry/+` e inoltra gli aggiornamenti al browser (WebSocket/SSE), così sparisce il polling.
- **Viaggi e soste da flespi**: i *calculators* di flespi producono intervalli già calcolati, più precisi del calcolo fatto nel browser.
- Indirizzi (reverse geocoding), geofence e allarmi, reset password via email.

## Struttura

```
src/
  middleware.ts                 protezione delle pagine e delle API
  lib/flespi/client.ts          chiamate REST a flespi (solo dal server)
  lib/flespi/diagnose.ts        verifiche della pagina Collegamento flespi
  lib/flespi/normalize.ts       telemetria flespi -> stato veicolo
  lib/flespi/mock.ts            veicoli simulati (modalità demo)
  lib/auth/                     sessione (cookie JWT firmato) e perimetro dati
  lib/db/                       schema Drizzle (customers, customer_devices, users, vehicles, vehicle_reminders, geocache)
  lib/vehicleStats.ts           km, ore e litri del mese dai contatori (poche chiamate a flespi)
  app/(app)/veicoli/            Flotta, profilo e modifica del veicolo, promemoria e scadenze
  app/(app)/autisti/            autisti e abbinamenti ai veicoli (lib/drivers.ts)
  app/api/vehicles/...          API usate dal browser
  app/(app)/flotta/...          elenco, mappa live, dettaglio, storico
  lib/reports/                  catalogo, calcolo e formato dei report
  lib/tz.ts                     giorni e orari nel fuso Europe/Rome anche su server UTC
  app/(app)/report/             catalogo e pagine dei report
  app/(app)/admin/clienti/      clienti, utenti e assegnazione veicoli
  app/(app)/admin/flespi/       verifica del collegamento flespi
  components/map/               mappe OpenStreetMap (Leaflet) e Google
```

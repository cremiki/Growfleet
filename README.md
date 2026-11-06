# Flotta: frontend di tracking su flespi

Next.js 15 (App Router) + TypeScript. Il browser non parla mai direttamente con flespi: tutte le chiamate passano dal server dell'app, che custodisce il token.

```
Browser ──► Next.js (API /api/*, login, sessione) ──► flespi REST (flespi.io/gw/...)
                │
                └─► Postgres (utenti, clienti; in futuro storico dati)
```

## Funzioni della prima versione

- **Login separato** per il team (admin) e per gli utenti dei clienti.
- **Multi-cliente**: ogni cliente è un *subaccount flespi*. Il server aggiunge l'header `x-flespi-cid` a ogni chiamata, quindi un cliente vede solo i veicoli del suo subaccount; il controllo è applicato da flespi stesso, non solo dall'interfaccia.
- **Elenco veicoli** con ricerca e filtro per stato (in marcia, fermo con quadro acceso, spento, non raggiungibile).
- **Stato del veicolo**: quadro, velocità, carburante, contachilometri, ore motore, alimentazione, satelliti, più l'elenco completo dei parametri del dispositivo.
- **Mappa live** con OpenStreetMap (gratis) o Google Maps (con chiave), aggiornata ogni 10 secondi.
- **Storico percorsi**: oggi, ieri, ultime 24 ore o date a scelta (max 7 giorni), con distanza, tempo in marcia, velocità, elenco viaggi e riproduzione del percorso.
- **Pannello admin**: crea clienti (collegando un subaccount esistente o creandone uno nuovo in flespi) e utenti.
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

1. In flespi.io crea un token di tipo **Master** (serve per leggere/creare i subaccount e operare per conto dei clienti) e mettilo in `FLESPI_TOKEN`. Resta solo sul server.
2. Per ogni cliente crea un **subaccount** (dal pannello *Clienti e utenti* dell'app, oppure in flespi) e **sposta i suoi dispositivi** nel subaccount (in flespi: dispositivo › cambia account, o `PUT /gw/devices/{id}` con il nuovo `cid`).
3. Controlla che i dispositivi abbiano `messages_ttl` > 0, altrimenti flespi non conserva i messaggi e lo storico percorsi resta vuoto.
4. I parametri letti (carburante, contachilometri…) sono in `src/lib/flespi/normalize.ts`, con gli alias più comuni. Se i tuoi tracker usano nomi diversi, apri *Tutti i parametri del dispositivo* nell'app e aggiungi il nome giusto nell'elenco `PARAMS`.

> Account flespi Free: ha limiti su chiamate API e subaccount. L'app fa una chiamata ogni 10 secondi per ogni scheda aperta sulla mappa (con una cache di 3 secondi sul server). Se serve, alza `NEXT_PUBLIC_LIVE_REFRESH_SECONDS`.

## Deploy di test su Vercel

1. Pubblica il progetto su un repository GitHub e importalo in Vercel.
2. Aggiungi un database Postgres dal Marketplace di Vercel (es. Neon): imposta automaticamente `DATABASE_URL`. **Senza database su Vercel utenti e clienti si perdono a ogni riavvio.**
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

- **Storico proprio** (dati che flespi non conserva o conserva poco): sulla VPS, un servizio sempre attivo che riceve i messaggi da flespi con uno *stream HTTP* o un abbonamento MQTT a `flespi/message/gw/devices/+`, e li salva in Postgres + TimescaleDB. Lo storico percorsi può poi leggere da lì invece che da flespi.
- **Live via MQTT** sulla VPS: il server si abbona a `flespi/state/gw/devices/+/telemetry/+` e inoltra gli aggiornamenti al browser (WebSocket/SSE), così sparisce il polling.
- **Viaggi e soste da flespi**: i *calculators* di flespi producono intervalli già calcolati, più precisi del calcolo fatto nel browser.
- Indirizzi (reverse geocoding), geofence e allarmi, reset password via email.

## Struttura

```
src/
  middleware.ts                 protezione delle pagine e delle API
  lib/flespi/client.ts          chiamate REST a flespi (token + x-flespi-cid)
  lib/flespi/normalize.ts       telemetria flespi -> stato veicolo
  lib/flespi/mock.ts            veicoli simulati (modalità demo)
  lib/auth/                     sessione (cookie JWT firmato) e perimetro dati
  lib/db/                       schema Drizzle (customers, users)
  app/api/vehicles/...          API usate dal browser
  app/(app)/flotta/...          elenco, mappa live, dettaglio, storico
  app/(app)/admin/clienti/      gestione clienti e utenti
  components/map/               mappe OpenStreetMap (Leaflet) e Google
```

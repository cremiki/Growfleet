/**
 * Catalogo dei report, organizzato per categorie.
 * `ready: false` = report previsto ma non ancora disponibile; `needs` spiega cosa manca.
 */

export type ReportParam =
  | "vehicles" // selezione veicoli (multipla)
  | "vehicle" // un solo veicolo
  | "period" // intervallo di date
  | "timeRange" // fascia oraria nel giorno
  | "month" // mese
  | "datetime" // istante preciso
  | "speedLimit"
  | "minStop";

export type ReportDef = {
  id: string;
  category: string;
  title: string;
  description: string;
  ready: boolean;
  needs?: string;
  params: ReportParam[];
};

export const CATEGORIES: { id: string; title: string }[] = [
  { id: "itinerari", title: "Itinerari" },
  { id: "luoghi", title: "Luoghi e fermate" },
  { id: "dati", title: "Dati e monitoraggio" },
  { id: "riepiloghi", title: "Riepiloghi e guida" },
  { id: "worktime", title: "Tempi di lavoro" },
  { id: "can", title: "Dati CAN" },
  { id: "carburante", title: "Carburante" },
  { id: "sensori", title: "Sensori e accessori" },
  { id: "altro", title: "Tachigrafo e altro" },
];

const R = (
  id: string, category: string, title: string, description: string,
  params: ReportParam[], ready = true, needs?: string,
): ReportDef => ({ id, category, title, description, params, ready, needs });

const NEEDS_DRIVERS = "Serve la gestione degli autisti, non ancora disponibile.";
const NEEDS_ZONES = "Serve la gestione delle zone (geofence), non ancora disponibile.";
const NEEDS_WORK = "Serve la classificazione dei viaggi in lavoro e privati, non ancora disponibile.";
const NEEDS_FUEL = "Arriverà con la sezione Carburante.";
const NEEDS_SENSOR = "Richiede sensori dedicati sul veicolo.";

export const REPORTS: ReportDef[] = [
  // Itinerari
  R("itinerari", "itinerari", "Itinerari", "Ogni tragitto con orario e luogo di partenza e di arrivo, distanza, durata, velocità massima e media.", ["vehicles", "period", "timeRange"]),
  R("mensile-km", "itinerari", "Rapporto mensile (km)", "Chilometri percorsi da ogni veicolo giorno per giorno, su tutto il mese, con i totali.", ["vehicles", "month"]),
  R("mensile-ore", "itinerari", "Report mensile (ore)", "Ore di guida di ogni veicolo giorno per giorno, su tutto il mese.", ["vehicles", "month"]),
  R("giornaliero", "itinerari", "Rapporto giornaliero", "Per ogni veicolo e ogni giorno: tragitti, soste, distanza e contachilometri.", ["vehicles", "period"], false, "In arrivo nella prossima tornata: per ora usa Itinerari o Riepilogo (per giorni)."),
  R("distanza-ore", "itinerari", "Distanza per ore", "Chilometri percorsi in ogni ora della giornata.", ["vehicles", "period"], false, "In arrivo nella prossima tornata."),
  R("distanza-anno", "itinerari", "Distanza (anno)", "Chilometri di ogni veicolo mese per mese, per un anno intero.", ["vehicles"], false, "Richiede lo storico salvato sulla VPS: flespi rende troppo lento un anno di messaggi."),
  R("panoramica-percorsi", "itinerari", "Panoramica dei percorsi", "Distanza e tempo per viaggi di lavoro e privati.", ["vehicles", "period"], false, NEEDS_WORK),
  R("spese-percorso", "itinerari", "Spese di percorso", "Rimborsi per chilometro e per passeggero dei viaggi di lavoro.", ["vehicles", "period"], false, NEEDS_WORK),
  R("chilometraggio-paesi", "itinerari", "Chilometraggio per paesi", "Chilometri e tempo di guida per paese attraversato.", ["vehicles", "period"], false, "In arrivo nella prossima tornata."),

  // Luoghi e fermate
  R("fermate", "luoghi", "Report fermate", "Dove e per quanto tempo si è fermato ogni veicolo.", ["vehicles", "period", "minStop"]),
  R("coordinate", "luoghi", "Coordinate", "Tutte le posizioni registrate da un veicolo, con orario e velocità.", ["vehicle", "period", "timeRange"]),
  R("posizionamento", "luoghi", "Posizionamento flotta", "Dove si trovava ogni veicolo in una data e ora precise.", ["vehicles", "datetime"]),
  R("ingresso-uscita", "luoghi", "Entrata/uscita dalle zone", "Quando i veicoli entrano ed escono dalle zone definite.", ["vehicles", "period"], false, NEEDS_ZONES),
  R("attivita-zona", "luoghi", "Attività nelle zone", "Visite alle zone con durata e tempo di guida.", ["vehicles", "period"], false, NEEDS_ZONES),

  // Dati e monitoraggio
  R("tensione", "dati", "Tensione di alimentazione", "Tensione minima, media e massima e interruzioni di alimentazione del dispositivo.", ["vehicles", "period"]),
  R("ore-motore", "dati", "Ore lavorative (chiave on)", "Ore con il quadro acceso di ogni veicolo, giorno per giorno sul mese.", ["vehicles", "month"]),
  R("errori-gps", "dati", "Errori GPS", "Periodi senza segnale GPS valido.", ["vehicles", "period"], false, "In arrivo nella prossima tornata."),
  R("valori-personalizzati", "dati", "Valori personalizzati", "Grafico di qualunque parametro inviato dal dispositivo.", ["vehicle", "period"], false, "In arrivo nella prossima tornata."),

  // Riepiloghi e guida
  R("riepilogo-veicoli", "riepiloghi", "Riepilogo (per veicoli)", "Per ogni veicolo: distanza, contachilometri a inizio e fine periodo, carburante, velocità massima, tempo di guida, fermate e sosta.", ["vehicles", "period"]),
  R("riepilogo-giorni", "riepiloghi", "Riepilogo (per giorni)", "Distanza, tempo di guida, sosta e carburante di ogni veicolo, giorno per giorno.", ["vehicles", "period"]),
  R("eccesso-velocita", "riepiloghi", "Eccesso di velocità", "Quando, dove, per quanto tempo e di quanto ogni veicolo ha superato il limite.", ["vehicles", "period", "timeRange", "speedLimit"]),
  R("riepilogo-autisti", "riepiloghi", "Riepilogo (autista)", "Chilometri, ore di lavoro e consumi per autista.", ["period"], false, NEEDS_DRIVERS),
  R("guida-riposo", "riepiloghi", "Tempi di guida e riposo", "Tempi di guida e riposo per autista, aggiornati in tempo reale.", ["period"], false, NEEDS_DRIVERS),
  R("ore-guida-orarie", "riepiloghi", "Ore di guida per fascia oraria", "Minuti di guida in ogni ora del giorno, sommati sul periodo.", ["vehicles", "period"], false, "In arrivo nella prossima tornata."),

  // Tempi di lavoro
  R("grafico-lavoro", "worktime", "Grafico del lavoro", "Quota della giornata in marcia, fermo acceso e parcheggiato.", ["vehicles", "period"], false, "In arrivo nella prossima tornata."),
  R("orari-lavoro", "worktime", "Rispetto degli orari di lavoro", "Confronto fra orario di lavoro impostato e uso effettivo del veicolo.", ["vehicles", "period"], false, "Serve impostare gli orari di lavoro dei veicoli."),

  // CAN
  R("gps-vs-can", "can", "Rapporto mensile (km) GPS e CAN", "Chilometri giornalieri calcolati dal GPS confrontati con il contachilometri del veicolo.", ["vehicles", "month"]),
  R("can-report", "can", "Report CAN", "Chilometraggio, ore motore e consumi letti dalla centralina.", ["vehicles", "period"], false, "In arrivo nella prossima tornata."),

  // Carburante
  R("co2", "carburante", "Emissioni di CO2", "Emissioni stimate dal carburante consumato.", ["vehicles", "period"], false, NEEDS_FUEL),
  R("rifornimenti", "carburante", "Rifornimenti e cali", "Rifornimenti e cali sospetti di carburante.", ["vehicles", "period"], false, NEEDS_FUEL),

  // Sensori
  R("temperatura", "sensori", "Grafico della temperatura", "Andamento dei sensori di temperatura.", ["vehicles", "period"], false, NEEDS_SENSOR),
  R("accessori", "sensori", "Stato accessori", "Uso degli accessori collegati (PTO, pompe, porte…).", ["vehicles", "period"], false, NEEDS_SENSOR),

  // Altro
  R("tachigrafo", "altro", "Tachigrafo", "Dati scaricati dal tachigrafo digitale.", ["period"], false, "Richiede lo scarico remoto del tachigrafo."),
];

export const reportById = (id: string) => REPORTS.find((r) => r.id === id);

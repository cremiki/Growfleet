// Formato comune dei risultati: la stessa tabella serve per lo schermo, Excel e la stampa.

export type ColKind =
  | "text" | "int" | "km" | "dur" | "hours" | "time" | "datetime" | "date"
  | "speed" | "liters" | "volt" | "address" | "coords" | "onoff";

export type Column = { key: string; label: string; kind: ColKind; weekend?: boolean; optional?: boolean; compact?: boolean };
export type Place = { lat: number; lon: number };
export type Cell = string | number | boolean | null | Place;
export type Row = Record<string, Cell>;
export type Group = { title: string; subtitle?: string; rows: Row[]; totals?: Row };

export type ReportResult = {
  columns: Column[];
  groups: Group[];
  totals?: Row; // totale generale
  notes?: string[];
};

export type ReportInput = {
  vehicleIds: number[]; // vuoto = tutti i veicoli visibili
  from?: number;
  to?: number;
  month?: string; // "2026-11"
  timeFrom?: string; // "08:00"
  timeTo?: string; // "18:00"
  speedLimit?: number;
  minStop?: number; // minuti
  at?: number; // istante per il posizionamento
};

export const isPlace = (c: Cell): c is Place => !!c && typeof c === "object" && "lat" in c;

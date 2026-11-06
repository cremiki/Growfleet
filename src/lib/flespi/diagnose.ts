import { PARAMS } from "./normalize";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";
export type Check = { title: string; status: CheckStatus; detail: string };

/** Le grandezze mostrate nell'app e, per ciascuna, quale parametro flespi la fornisce */
export const METRICS: { key: keyof typeof PARAMS; label: string }[] = [
  { key: "lat", label: "Posizione" },
  { key: "speed", label: "Velocità" },
  { key: "ignition", label: "Quadro acceso/spento" },
  { key: "fuelLevel", label: "Carburante (%)" },
  { key: "fuelVolume", label: "Carburante (litri)" },
  { key: "odometerKm", label: "Contachilometri" },
  { key: "engineHours", label: "Ore motore" },
  { key: "externalV", label: "Alimentazione" },
];

export type DeviceCoverage = {
  id: number;
  name: string;
  ident: string;
  messagesTtl: number | null;
  paramCount: number;
  found: Record<string, string | null>; // metric key -> parametro trovato
  candidates: string[]; // parametri che sembrano utili ma non sono ancora mappati
};

export type Diagnosis = {
  mock: boolean;
  configured: boolean;
  checks: Check[];
  tokenInfo: Record<string, unknown> | null;
  devices: DeviceCoverage[];
};

type Attempt<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
type RawDev = { id: number; name?: string; configuration?: { ident?: string } | null; messages_ttl?: number };
type RawTel = { id: number; telemetry?: Record<string, unknown> };

const KNOWN = new Set<string>(Object.values(PARAMS).flat());
const INTERESTING = /fuel|mileage|odometer|ignition|motorhours|engine\.hours|power|voltage|can\.|tank/i;

export function coverage(dev: RawDev, tel: Record<string, unknown> = {}): DeviceCoverage {
  const names = Object.keys(tel).filter((n) => n !== "position");
  const found: Record<string, string | null> = {};
  for (const m of METRICS) found[m.key] = (PARAMS[m.key] as readonly string[]).find((p) => p in tel) ?? null;
  return {
    id: dev.id,
    name: dev.name || `Dispositivo ${dev.id}`,
    ident: dev.configuration?.ident ?? "",
    messagesTtl: dev.messages_ttl ?? null,
    paramCount: names.length,
    found,
    candidates: names.filter((n) => !KNOWN.has(n) && INTERESTING.test(n)).sort().slice(0, 12),
  };
}

export function buildDiagnosis(input: {
  configured: boolean;
  info?: Attempt<Record<string, unknown>[]>;
  platform?: Attempt<unknown[]>;
  devices?: Attempt<RawDev[]>;
  telemetry?: Attempt<RawTel[]>;
  messages?: Attempt<unknown[]> | null;
  messagesDevice?: number | null;
}): Diagnosis {
  if (!input.configured) {
    return {
      mock: false, configured: false, tokenInfo: null, devices: [],
      checks: [{ title: "Token flespi", status: "fail", detail: "FLESPI_TOKEN non è impostato: l'app sta mostrando veicoli simulati." }],
    };
  }
  const checks: Check[] = [];
  const { info, platform, devices, telemetry, messages } = input;

  if (info?.ok) {
    checks.push({ title: "Token valido", status: "ok", detail: "flespi riconosce il token." });
  } else {
    checks.push({
      title: "Token valido", status: "fail",
      detail: info?.status === 401 || info?.status === 403
        ? "flespi rifiuta il token: è sbagliato, scaduto o disattivato. Creane uno nuovo e aggiorna FLESPI_TOKEN."
        : `Non riesco a contattare flespi: ${info?.error ?? "errore sconosciuto"}`,
    });
  }

  if (platform?.ok) {
    checks.push({ title: "Permessi minimi", status: "warn", detail: "Il token è di tipo Master: può gestire tutto l'account. Per l'app basta un token ACL in sola lettura." });
  } else if (info?.ok) {
    checks.push({ title: "Permessi minimi", status: "ok", detail: "Il token non ha accesso all'amministrazione dell'account." });
  }

  if (devices?.ok) {
    const n = devices.value.length;
    checks.push({
      title: "Lettura dei dispositivi", status: n ? "ok" : "warn",
      detail: n ? `Il token vede ${n} dispositivi.` : "Il token funziona ma non vede nessun dispositivo: controlla che l'ACL includa gw/devices con 'all'.",
    });
  } else if (devices) {
    checks.push({ title: "Lettura dei dispositivi", status: "fail", detail: `Accesso negato a gw/devices: ${devices.error}` });
  }

  if (telemetry?.ok) {
    const withPos = telemetry.value.filter((t) => t.telemetry && "position.latitude" in t.telemetry).length;
    checks.push({
      title: "Telemetria (stato attuale)", status: withPos ? "ok" : "warn",
      detail: withPos ? `${withPos} dispositivi hanno una posizione.` : "Nessun dispositivo ha ancora inviato una posizione.",
    });
  } else if (telemetry) {
    checks.push({ title: "Telemetria (stato attuale)", status: "fail", detail: `Accesso negato alla telemetria: ${telemetry.error}` });
  }

  if (messages?.ok) {
    checks.push({
      title: "Messaggi (storico percorsi)", status: messages.value.length ? "ok" : "warn",
      detail: messages.value.length
        ? `Lo storico è leggibile (provato sul dispositivo ${input.messagesDevice}).`
        : `Il dispositivo ${input.messagesDevice} non ha messaggi salvati negli ultimi 7 giorni: verifica messages_ttl.`,
    });
  } else if (messages) {
    checks.push({ title: "Messaggi (storico percorsi)", status: "fail", detail: `Accesso negato ai messaggi: ${messages.error}` });
  } else {
    checks.push({ title: "Messaggi (storico percorsi)", status: "skip", detail: "Nessun dispositivo con dati su cui provare." });
  }

  const telById = new Map((telemetry?.ok ? telemetry.value : []).map((t) => [t.id, t.telemetry ?? {}]));
  const devs = (devices?.ok ? devices.value : []).map((d) => coverage(d, telById.get(d.id)));
  const noTtl = devs.filter((d) => d.messagesTtl === 0);
  if (noTtl.length) {
    checks.push({
      title: "Conservazione messaggi", status: "warn",
      detail: `${noTtl.length} dispositivi hanno messages_ttl = 0: flespi non salva i loro messaggi e lo storico resterà vuoto.`,
    });
  }

  return { mock: false, configured: true, checks, tokenInfo: info?.ok ? info.value[0] ?? null : null, devices: devs };
}

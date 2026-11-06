import "server-only";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import { isMock } from "./env";

/**
 * Indirizzi da coordinate con OpenStreetMap (Nominatim).
 * Regole d'uso di Nominatim: massimo 1 richiesta al secondo e un User-Agent che identifica l'app.
 * Per questo: cache in memoria + tabella geocache, e richieste in coda una alla volta.
 * Con volumi alti conviene un'istanza Nominatim propria sulla VPS o un servizio a pagamento.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "Growfleet/0.1 (fleet tracking platform)";

export const geoKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

const memory = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

type NominatimAddress = Record<string, string | undefined>;

/** Formato all'italiana: "Via Vittorio Veneto, 10, 25052 Piamborno BS, Italia" */
export function formatAddress(a: NominatimAddress, fallback?: string): string {
  const street = a.road || a.pedestrian || a.footway || a.path || a.square || a.industrial || a.neighbourhood;
  const place = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality;
  const prov = (a["ISO3166-2-lvl6"] || "").split("-")[1];
  const parts = [
    street ? `${street}${a.house_number ? `, ${a.house_number}` : ""}` : null,
    [a.postcode, place, prov].filter(Boolean).join(" ") || null,
    a.country || null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : fallback ?? "";
}

async function fetchReverse(lat: number, lon: number): Promise<string | null> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=it&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as { address?: NominatimAddress; display_name?: string };
  if (!j.address) return null;
  return formatAddress(j.address, j.display_name);
}

// Demo: indirizzo approssimato dalla città più vicina
const DEMO_CITIES: [string, number, number][] = [
  ["00185 Roma RM", 41.9, 12.49], ["20121 Milano MI", 45.46, 9.19], ["40121 Bologna BO", 44.49, 11.34],
  ["10121 Torino TO", 45.07, 7.68], ["50122 Firenze FI", 43.77, 11.25], ["80133 Napoli NA", 40.85, 14.27],
];
function demoAddress(lat: number, lon: number) {
  const c = DEMO_CITIES.reduce((b, x) => (Math.hypot(x[1] - lat, x[2] - lon) < Math.hypot(b[1] - lat, b[2] - lon) ? x : b));
  const n = Math.round(Math.abs(lat * 1000 + lon * 1000)) % 120 + 1;
  return `Via di prova, ${n}, ${c[0]}, Italia`;
}

/**
 * Risolve gli indirizzi richiesti. Quelli in cache tornano subito; dei nuovi ne risolve al massimo
 * `budget` per chiamata (1 al secondo), gli altri restano in `pending` e il browser li richiede dopo.
 */
export async function reverseMany(points: [number, number][], budget = 4) {
  const keys = Array.from(new Set(points.map(([la, lo]) => geoKey(la, lo))));
  const out: Record<string, string> = {};
  if (isMock) {
    for (const k of keys) { const [la, lo] = k.split(",").map(Number); out[k] = demoAddress(la, lo); }
    return { addresses: out, pending: [] as string[] };
  }
  const missing: string[] = [];
  for (const k of keys) {
    const m = memory.get(k);
    if (m !== undefined) out[k] = m; else missing.push(k);
  }
  if (missing.length) {
    const db = await getDb();
    const rows = await db.select().from(schema.geocache).where(inArray(schema.geocache.key, missing));
    for (const r of rows) { memory.set(r.key, r.address); out[r.key] = r.address; }
  }
  const toFetch = keys.filter((k) => out[k] === undefined);
  const pending: string[] = [];
  for (const [i, k] of toFetch.entries()) {
    if (i >= budget) { pending.push(k); continue; }
    const [la, lo] = k.split(",").map(Number);
    try {
      const addr = await throttled(() => fetchReverse(la, lo));
      if (addr) {
        memory.set(k, addr);
        out[k] = addr;
        const db = await getDb();
        await db.insert(schema.geocache).values({ key: k, address: addr }).onConflictDoNothing();
      }
    } catch {
      /* Nominatim non raggiungibile: si mostrano le coordinate */
    }
  }
  return { addresses: out, pending };
}

export type SearchResult = { label: string; lat: number; lon: number };

export async function search(q: string): Promise<SearchResult[]> {
  if (isMock) {
    return DEMO_CITIES.filter((c) => c[0].toLowerCase().includes(q.toLowerCase()))
      .map((c) => ({ label: `${c[0]}, Italia`, lat: c[1], lon: c[2] }));
  }
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=it&q=${encodeURIComponent(q)}`;
  const res = await throttled(() => fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" }));
  if (!res.ok) return [];
  const j = (await res.json()) as { lat: string; lon: string; display_name: string; address?: NominatimAddress }[];
  return j.map((r) => ({
    label: r.address ? formatAddress(r.address, r.display_name) : r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

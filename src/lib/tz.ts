/**
 * Date e ore nel fuso dei clienti (Europe/Rome), anche quando il server gira in UTC (Vercel).
 * Configurabile con REPORT_TZ.
 */
export const TZ = process.env.REPORT_TZ || process.env.NEXT_PUBLIC_REPORT_TZ || "Europe/Rome";

type Parts = { y: number; m: number; d: number; h: number; min: number; s: number; wd: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function parts(ts: number, tz = TZ): Parts {
  const o: Record<string, string> = {};
  for (const p of fmt(tz).formatToParts(new Date(ts * 1000))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, s: +o.second, wd: WD[o.weekday] ?? 0 };
}

/** Istante UTC (secondi) corrispondente a una data e ora locali nel fuso tz */
export function zoned(y: number, m: number, d: number, h = 0, min = 0, tz = TZ): number {
  const guess = Date.UTC(y, m - 1, d, h, min) / 1000;
  const p = parts(guess, tz);
  const asIfUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) / 1000;
  const offset = asIfUtc - guess; // differenza del fuso in quel momento
  let ts = guess - offset;
  // correzione per i cambi d'ora
  const p2 = parts(ts, tz);
  if (p2.h !== h) ts -= (Date.UTC(p2.y, p2.m - 1, p2.d, p2.h, p2.min) / 1000 - Date.UTC(y, m - 1, d, h, min) / 1000);
  return ts;
}

export function dayStart(ts: number, tz = TZ) {
  const p = parts(ts, tz);
  return zoned(p.y, p.m, p.d, 0, 0, tz);
}

/** Giorni locali che coprono [from, to): coppie [inizio, fine] */
export function days(from: number, to: number, tz = TZ): [number, number][] {
  const out: [number, number][] = [];
  let a = dayStart(from, tz);
  while (a < to) {
    const p = parts(a + 36 * 3600, tz); // giorno successivo (robusto ai cambi d'ora)
    const b = zoned(p.y, p.m, p.d, 0, 0, tz);
    out.push([Math.max(a, from), Math.min(b, to)]);
    a = b;
  }
  return out;
}

export function monthRange(month: string, tz = TZ): [number, number, number] {
  const [y, m] = month.split("-").map(Number);
  const from = zoned(y, m, 1, 0, 0, tz);
  const to = m === 12 ? zoned(y + 1, 1, 1, 0, 0, tz) : zoned(y, m + 1, 1, 0, 0, tz);
  const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [from, to, nDays];
}

/** Minuti dalla mezzanotte locale */
export function minuteOfDay(ts: number, tz = TZ) {
  const p = parts(ts, tz);
  return p.h * 60 + p.min;
}

export function dateLabel(ts: number, tz = TZ) {
  const p = parts(ts, tz);
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

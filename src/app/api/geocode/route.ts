import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { reverseMany, search } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * GET /api/geocode?points=lat,lon;lat,lon  -> indirizzi (max 50 punti)
 * GET /api/geocode?q=testo                 -> ricerca indirizzo
 */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  if (q) {
    if (q.length < 3) return NextResponse.json({ results: [] });
    try {
      return NextResponse.json({ results: await search(q) });
    } catch {
      return NextResponse.json({ error: "Ricerca indirizzi non disponibile in questo momento." }, { status: 502 });
    }
  }
  const points = (sp.get("points") ?? "")
    .split(";")
    .map((p) => p.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)
    .slice(0, 50);
  return NextResponse.json(await reverseMany(points));
}

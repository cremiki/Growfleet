import { NextResponse } from "next/server";
import { withScope } from "@/lib/api";
import { fleet } from "@/lib/flespi";

export const dynamic = "force-dynamic";

const MAX_RANGE_S = 7 * 24 * 3600;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const sp = new URL(req.url).searchParams;
  const from = Number(sp.get("from"));
  const to = Number(sp.get("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return NextResponse.json({ error: "Intervallo non valido: la fine deve essere dopo l'inizio." }, { status: 400 });
  }
  if (to - from > MAX_RANGE_S) {
    return NextResponse.json({ error: "Puoi consultare al massimo 7 giorni alla volta." }, { status: 400 });
  }
  return withScope(req, async (scope) => {
    const points = await fleet.getTrack(scope, id, Math.floor(from), Math.ceil(to));
    if (!points) return NextResponse.json({ error: "Veicolo non trovato." }, { status: 404 });
    return NextResponse.json({ points });
  });
}

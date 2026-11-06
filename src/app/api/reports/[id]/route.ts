import { NextResponse } from "next/server";
import { z } from "zod";
import { withScope } from "@/lib/api";
import { runReport, ReportError } from "@/lib/reports/engine";
import { reportById } from "@/lib/reports/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // un mese di messaggi per molti veicoli può richiedere tempo

const time = z.string().regex(/^\d{2}:\d{2}$/).optional();
const schema = z.object({
  vehicleIds: z.array(z.number().int().positive()).max(500).default([]),
  from: z.number().int().positive().optional(),
  to: z.number().int().positive().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  timeFrom: time,
  timeTo: time,
  speedLimit: z.number().int().min(5).max(300).optional(),
  minStop: z.number().int().min(1).max(1440).optional(),
  at: z.number().int().positive().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const def = reportById(id);
  if (!def || !def.ready) return NextResponse.json({ error: "Questo report non è ancora disponibile." }, { status: 404 });
  let input;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Parametri del report non validi." }, { status: 400 });
  }
  return withScope(req, async (scope) => {
    try {
      return NextResponse.json(await runReport(id, scope, input));
    } catch (e) {
      if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
  });
}

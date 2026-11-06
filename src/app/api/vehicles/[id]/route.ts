import { NextResponse } from "next/server";
import { withScope } from "@/lib/api";
import { fleet } from "@/lib/flespi";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  return withScope(req, async (scope) => {
    const v = Number.isInteger(id) ? await fleet.getVehicle(scope, id) : null;
    if (!v) return NextResponse.json({ error: "Veicolo non trovato." }, { status: 404 });
    return NextResponse.json(v);
  });
}

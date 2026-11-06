import { NextResponse } from "next/server";
import { withScope } from "@/lib/api";
import { fleet } from "@/lib/flespi";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withScope(req, async (scope) => NextResponse.json({ vehicles: await fleet.listVehicles(scope), at: Date.now() }));
}

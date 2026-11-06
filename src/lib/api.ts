import "server-only";
import { NextResponse } from "next/server";
import { getSession, scopeFor, ScopeError, type Scope } from "./auth/session";
import { FlespiError } from "./flespi";

export async function withScope(
  req: Request,
  fn: (scope: Scope) => Promise<Response>,
): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
  try {
    const cidParam = new URL(req.url).searchParams.get("cid");
    const scope = await scopeFor(session, cidParam ? Number(cidParam) : null);
    return await fn(scope);
  } catch (e) {
    if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof FlespiError) {
      const msg = e.status === 401 || e.status === 403
        ? "flespi ha rifiutato il token: controlla FLESPI_TOKEN."
        : `Errore da flespi: ${e.message}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    console.error(e);
    return NextResponse.json({ error: "Errore interno del server." }, { status: 500 });
  }
}

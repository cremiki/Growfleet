import { notFound } from "next/navigation";
import { requireSession, scopeFor } from "@/lib/auth/session";
import { fleet } from "@/lib/flespi";
import { HistoryView } from "./HistoryView";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await requireSession();
  const scope = await scopeFor(s);
  const v = Number.isInteger(id) ? await fleet.getVehicle(scope, id) : null;
  if (!v) notFound();
  return <HistoryView id={id} name={v.state.name} />;
}

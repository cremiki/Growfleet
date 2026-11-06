import { notFound } from "next/navigation";
import { reportById } from "@/lib/reports/catalog";
import { ReportView } from "./ReportView";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const def = reportById((await params).id);
  if (!def || !def.ready) notFound();
  return <ReportView def={def} />;
}

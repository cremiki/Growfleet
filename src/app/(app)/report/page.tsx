import { CATEGORIES, REPORTS } from "@/lib/reports/catalog";
import { ReportCatalog } from "./ReportCatalog";

export default function ReportPage() {
  return <ReportCatalog categories={CATEGORIES} reports={REPORTS} />;
}

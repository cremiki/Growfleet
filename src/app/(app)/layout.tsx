import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { isMock } from "@/lib/env";
import { logout } from "../login/actions";
import { Rail } from "@/components/Rail";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <div className="h-dvh flex flex-col">
      <header className="bg-surface border-b border-line flex items-center gap-4 pl-3 pr-4 h-12 shrink-0 print:hidden">
        <Link href="/flotta" className="plate text-[22px] font-bold text-sign tracking-wide">Growfleet</Link>
        {isMock && (
          <span className="text-xs bg-idle text-ink font-semibold px-2 py-0.5 rounded-sm" title="Imposta FLESPI_TOKEN per usare i dati reali">
            Demo
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:flex flex-col items-end leading-tight">
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted">{s.role === "admin" ? "Team" : s.email}</span>
          </span>
          <form action={logout}>
            <button className="px-3 py-1.5 rounded border border-line hover:bg-asphalt">Esci</button>
          </form>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex">
        <Rail isAdmin={s.role === "admin"} />
        <div className="flex-1 min-w-0 min-h-0">{children}</div>
      </div>
    </div>
  );
}

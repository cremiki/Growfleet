import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { isMock } from "@/lib/env";
import { logout } from "../login/actions";
import { NavLink } from "@/components/NavLink";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <div className="h-dvh flex flex-col">
      <header className="bg-sign text-white flex items-center gap-6 px-4 h-13 shrink-0">
        <Link href="/flotta" className="plate text-2xl font-bold tracking-wide">Flotta</Link>
        <nav className="flex items-center gap-1 text-[15px]">
          <NavLink href="/flotta">Veicoli</NavLink>
          {s.role === "admin" && <NavLink href="/admin/clienti">Clienti e utenti</NavLink>}
        </nav>
        {isMock && (
          <span className="text-sm bg-idle text-ink font-semibold px-2 py-0.5 rounded-sm" title="Imposta FLESPI_TOKEN per usare i dati reali">
            Demo
          </span>
        )}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="hidden sm:inline text-white/85">
            {s.name}{s.role === "admin" ? ", team" : ""}
          </span>
          <form action={logout}>
            <button className="px-3 py-1.5 rounded-md hover:bg-white/10">Esci</button>
          </form>
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

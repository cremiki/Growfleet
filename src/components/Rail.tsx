"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode; soon?: boolean; admin?: boolean };

const I = {
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 2.2 6 2v11.6l-6-2V6.2Z" />,
  report: <path d="M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM9 12h8v1.6H9V12Zm0 3.5h8v1.6H9v-1.6Z" />,
  fuel: <path d="M5 3h9v8h1.5a2 2 0 0 1 2 2v4a1 1 0 0 0 2 0V9l-2-2 1.2-1.2L21 8v9a3 3 0 0 1-6 0v-4h-1v8H5V3Zm2 2v5h5V5H7Z" />,
  people: <path d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm-7 9c0-3.5 3-6 7-6s7 2.5 7 6v1H2v-1Zm15-9.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm1.5 2.4c2.4.6 3.5 2.6 3.5 5.8v1h-3.6v-1c0-2.2-.6-4.2-1.9-5.6l2-.2Z" />,
  plug: <path d="M8 2h2v5h4V2h2v5h2v4a6 6 0 0 1-5 5.9V22h-2v-5.1A6 6 0 0 1 6 11V7h2V2Z" />,
};

const ITEMS: Item[] = [
  { href: "/flotta", label: "Live map", icon: I.map },
  { href: "/report", label: "Report (in arrivo)", icon: I.report, soon: true },
  { href: "/carburante", label: "Carburante (in arrivo)", icon: I.fuel, soon: true },
  { href: "/admin/clienti", label: "Clienti e utenti", icon: I.people, admin: true },
  { href: "/admin/flespi", label: "Collegamento flespi", icon: I.plug, admin: true },
];

export function Rail({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Sezioni" className="w-12 shrink-0 bg-ink flex flex-col items-center py-2 gap-1">
      {ITEMS.filter((i) => !i.admin || isAdmin).map((i) => {
        const active = path.startsWith(i.href);
        const cls = `group relative flex size-10 items-center justify-center rounded ${active ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`;
        const svg = <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>{i.icon}</svg>;
        const tip = (
          <span className="pointer-events-none absolute left-12 z-[2000] whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            {i.label}
          </span>
        );
        return i.soon ? (
          <span key={i.href} className={`${cls} cursor-not-allowed text-white/25 hover:text-white/25 hover:bg-transparent`} aria-disabled title={i.label}>
            {svg}{tip}
          </span>
        ) : (
          <Link key={i.href} href={i.href} aria-label={i.label} aria-current={active ? "page" : undefined} className={cls}>
            {svg}{tip}
          </Link>
        );
      })}
    </nav>
  );
}

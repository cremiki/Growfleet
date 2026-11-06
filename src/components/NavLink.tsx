"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`px-3 py-1.5 rounded-md ${active ? "bg-white/15 font-semibold" : "hover:bg-white/10 text-white/85"}`}>
      {children}
    </Link>
  );
}

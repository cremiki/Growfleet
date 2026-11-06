import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login")) {
    if (session) return NextResponse.redirect(new URL("/flotta", req.url));
    return NextResponse.next();
  }
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/flotta", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|svg|jpg|woff2?)$).*)"],
};

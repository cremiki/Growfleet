// Firma/verifica del cookie di sessione. Nessun import server-only: è usato anche dal middleware (edge).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "fleet_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 ore

export type SessionPayload = {
  uid: number;
  role: "admin" | "customer";
  customerId: number | null;
  name: string;
  email: string;
};

function key(): Uint8Array {
  let secret = process.env.AUTH_SECRET || "";
  if (secret.length < 32) {
    const realData = !!process.env.FLESPI_TOKEN && process.env.FLESPI_MOCK !== "1";
    if (process.env.NODE_ENV === "production" && realData) {
      throw new Error("AUTH_SECRET mancante o troppo corto (min 32 caratteri).");
    }
    secret = "dev-only-insecure-secret-change-me-please-0123456789"; // solo sviluppo / demo
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

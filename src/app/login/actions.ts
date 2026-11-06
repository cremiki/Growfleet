"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };

  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
    return { error: "Email o password non corrette." };
  }
  await createSession({ uid: u.id, role: u.role, customerId: u.customerId, name: u.name, email: u.email });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/flotta");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

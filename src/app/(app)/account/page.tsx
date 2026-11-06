import { requireSession } from "@/lib/auth/session";
import { AccountForms } from "./AccountForms";

export default async function AccountPage() {
  const s = await requireSession();
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-xl">
        <h1 className="text-2xl font-semibold">Il mio account</h1>
        <p className="text-muted mt-1">{s.email}, {s.role === "admin" ? "accesso da team" : "utente cliente"}.</p>
        <AccountForms name={s.name} />
      </div>
    </div>
  );
}

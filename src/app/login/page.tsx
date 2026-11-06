import { isMock } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="min-h-full grid md:grid-cols-[1fr_minmax(380px,460px)]">
      <section className="hidden md:flex flex-col justify-end bg-sign text-white p-12 relative overflow-hidden">
        <RoadLines />
        <div className="relative max-w-md">
          <p className="plate text-6xl font-bold leading-none">Flotta</p>
          <p className="mt-4 text-lg text-white/85 leading-relaxed">
            Dove sono i tuoi veicoli, se sono accesi e quanta strada hanno fatto.
          </p>
        </div>
      </section>
      <section className="flex flex-col justify-center px-8 py-12 bg-surface">
        <div className="w-full max-w-sm mx-auto">
          <p className="plate text-3xl font-bold md:hidden mb-8 text-sign">Flotta</p>
          <h1 className="text-2xl font-semibold">Accedi</h1>
          <p className="text-muted mt-1">Usa le credenziali che ti abbiamo fornito.</p>
          <LoginForm next={next ?? ""} />
          {isMock && (
            <div className="mt-8 border-l-4 border-idle bg-asphalt/60 px-4 py-3 text-sm leading-relaxed">
              <p className="font-semibold">Modalità demo, veicoli simulati</p>
              <p className="text-muted mt-1">
                Team: admin@demo.it<br />Cliente: cliente@demo.it<br />Password per entrambi: demo1234
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** Segnaletica orizzontale stilizzata: l'unico elemento decorativo dell'app */
function RoadLines() {
  return (
    <svg aria-hidden className="absolute inset-0 w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
      <path d="M-40 760 C 180 600, 260 420, 640 120" stroke="white" strokeOpacity="0.14" strokeWidth="90" fill="none" />
      <path d="M-40 760 C 180 600, 260 420, 640 120" stroke="white" strokeOpacity="0.55" strokeWidth="4" strokeDasharray="34 26" fill="none" />
      <path d="M-80 520 C 120 470, 300 300, 420 -40" stroke="white" strokeOpacity="0.08" strokeWidth="60" fill="none" />
    </svg>
  );
}

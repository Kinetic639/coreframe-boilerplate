import { Lock, Mail, ShieldAlert, Sparkles, UserCheck } from "lucide-react";
import { signInDemoClientAction } from "./actions";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-muted px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-extrabold tracking-wider text-primary-foreground shadow-md">
            A
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Ambra VMI Client
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dedykowany portal klienta VMI / Platforma B2B Ambra
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-10">
          <form action={signInDemoClientAction} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
                E-mail sluzbowy
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue="m.stepien@autoservice-komorniki.pl"
                  className="block min-h-12 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
                Haslo dostepu
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  defaultValue="demo-password"
                  className="block min-h-12 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  name="remember"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Zapamietaj mnie
              </label>
              <span className="text-sm font-medium text-primary">Demo</span>
            </div>

            <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  To jest tymczasowe logowanie demo. Produkcyjna autoryzacja zostanie podlaczona po
                  zamrozeniu modelu MVP.
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.99]"
            >
              Zaloguj sie
            </button>
          </form>

          <div className="mt-8 rounded-xl bg-muted p-4">
            <div className="flex gap-3">
              <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-xs font-semibold text-primary">
                  Profil demonstracyjny aktywnego klienta
                </h2>
                <div className="mt-2 space-y-0.5 rounded-lg bg-background p-2 font-mono text-xs text-muted-foreground">
                  <div>Uzytkownik: Michal Stepien</div>
                  <div>Rola: Kierownik Oddzialu</div>
                  <div>Firma: AutoService Komorniki</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Interaktywny tryb demo oparty o mockowane dane</span>
        </div>
      </section>
    </main>
  );
}

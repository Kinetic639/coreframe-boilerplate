export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Ambra VMI</p>
        <h1 className="mt-3 font-display text-2xl font-black">Logowanie klienta</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Produkcyjny formularz logowania zostanie podłączony w fazie bezpieczeństwa i dostępu.
        </p>
      </section>
    </main>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-muted px-4 py-6">
      {children}
    </main>
  );
}

export default function QRLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <main className="min-h-screen bg-background">{children}</main>
      </body>
    </html>
  );
}

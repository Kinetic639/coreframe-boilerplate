import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ambra VMI Client",
  description: "Client portal for Ambra Vendor-Managed Inventory workflows"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body className="bg-slate-50 font-sans text-slate-950 antialiased">{children}</body>
    </html>
  );
}

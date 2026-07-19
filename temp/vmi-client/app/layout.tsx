import type {Metadata} from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ambra VMI Client - Mobilny Portal VMI',
  description: 'Mobilna i stacjonarna aplikacja kliencka Vendor-Managed Inventory platformy Ambra',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pl" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="bg-gray-50 text-gray-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { EphemeralProvider } from '@/context/EphemeralContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Ephemeral – Bitcoin Testnet Messaging',
  description:
    'Deniable, one-shot messaging backed by deterministic keys derived from a shared BIP39 secret phrase.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-100 antialiased`}
      >
        <EphemeralProvider>{children}</EphemeralProvider>
      </body>
    </html>
  );
}

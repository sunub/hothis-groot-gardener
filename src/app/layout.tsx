import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'Space Garden Simulator',
  description:
    'A training simulation for growing red romaine lettuce in the ISS Veggie unit: track plant state, respond to crises recorded in NASA plant growth tests, and read a ground analysis report.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}

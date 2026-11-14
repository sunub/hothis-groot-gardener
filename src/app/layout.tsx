import type { Metadata } from 'next';
import { DotGothic16, Pixelify_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n';
import './globals.css';

const pixelify = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixelify' });
const dot = DotGothic16({ subsets: ['latin'], weight: '400', variable: '--font-dot' });

export const metadata: Metadata = {
  title: 'Space Garden Simulator',
  description:
    'A training simulation for growing red romaine lettuce in the ISS Veggie unit: track plant state, respond to crises recorded in NASA plant growth tests, and read a ground analysis report.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${pixelify.variable} ${dot.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}

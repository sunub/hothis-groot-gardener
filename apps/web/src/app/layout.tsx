import type { Metadata } from 'next';
import { DotGothic16, Noto_Sans_KR, Pixelify_Sans, VT323 } from 'next/font/google';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n';
import './globals.css';

const pixelify = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixelify' });
const dot = DotGothic16({ subsets: ['latin'], weight: '400', variable: '--font-dot' });
// Hangul is not in the pixel typefaces. The browser fetches only the Hangul chunks it needs, when the page is Korean.
const notoKr = Noto_Sans_KR({ weight: ['400', '700'], variable: '--font-noto-kr', preload: false });
const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--font-vt323' });

export const metadata: Metadata = {
  title: 'Space Garden Simulator',
  description:
    'A training simulation for growing red romaine lettuce in the ISS Veggie unit: track plant state, respond to crises recorded in NASA plant growth tests, and read a ground analysis report.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${pixelify.variable} ${dot.variable} ${vt323.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}

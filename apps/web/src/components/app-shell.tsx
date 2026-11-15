'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageSwitch } from '@/components/language-switch';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { ROUTES } from '@/features/mission/routes';
import { useDictionary } from '@/lib/i18n';

/** Page frame: header with the app name and navigation, main area, footer with the standing notices. */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useDictionary();
  return (
    <>
      <header className="border-b-4 border-surface-2 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={ROUTES.home} className="flex items-center gap-2 font-title text-heading font-bold">
            <PixelIcon name="sprout" />
            {t.common.app_name}
          </Link>
          <nav aria-label={t.common.nav.label} className="flex items-center gap-4 text-body text-ink-muted">
            <Link href={ROUTES.home} className="hover:text-ink">
              {t.common.nav.home}
            </Link>
            <Link href={ROUTES.sources} className="hover:text-ink">
              {t.common.nav.sources}
            </Link>
            <LanguageSwitch />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t-4 border-surface-2">
        <div className="mx-auto w-full max-w-6xl space-y-1 px-4 py-4 text-caption text-ink-muted">
          <p>{t.common.disclaimer.simulation}</p>
          <p>{t.common.disclaimer.not_diagnostic}</p>
        </div>
      </footer>
    </>
  );
}

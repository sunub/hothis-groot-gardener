'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageSwitch } from '@/components/language-switch';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { ROUTES } from '@/features/mission/routes';
import { useDictionary } from '@/lib/i18n';

/**
 * Page frame: header with the app name and navigation, main area, footer with the standing notices.
 * `wide` gives the main area the full width (up to 1600px) with a thin margin, for the landing scene.
 */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const t = useDictionary();
  return (
    <>
      <header className="border-b-4 border-surface-2 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[87rem] items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-14">
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
      <main
        className={
          wide
            ? 'mx-auto w-full max-w-[1624px] flex-1 p-3'
            : 'mx-auto w-full max-w-[87rem] flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-14'
        }
      >
        {children}
      </main>
      <footer className="border-t-4 border-surface-2">
        <div className="mx-auto w-full max-w-[87rem] space-y-1 px-4 py-4 sm:px-8 lg:px-14 text-caption text-ink-muted">
          <p>{t.common.disclaimer.simulation}</p>
          <p>{t.common.disclaimer.not_diagnostic}</p>
        </div>
      </footer>
    </>
  );
}

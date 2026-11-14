import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { DesignSystemCatalog } from '@/features/design-system/catalog';

export const metadata: Metadata = {
  title: 'Design system · Space Garden Simulator',
  robots: { index: false, follow: false },
};

/** Developer page: every primitive of the pixel design system on one screen. */
export default function DesignSystemPage() {
  return (
    <AppShell>
      <DesignSystemCatalog />
    </AppShell>
  );
}

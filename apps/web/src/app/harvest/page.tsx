import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { HarvestScreen } from '@/features/report/harvest-screen';
import { en } from '@/lib/i18n/en';

export const metadata: Metadata = {
  title: `${en.report.harvest.title} · ${en.common.app_name}`,
};

// Static shell: the screen reads the mission and the evidence list on the client.
export default function HarvestPage() {
  return (
    <AppShell>
      <HarvestScreen />
    </AppShell>
  );
}

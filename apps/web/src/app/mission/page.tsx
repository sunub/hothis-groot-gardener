import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { MissionScreen } from '@/features/grow-room/mission-screen';
import { en } from '@/lib/i18n/en';

export const metadata: Metadata = {
  title: `${en.mission.screen.title} · ${en.common.app_name}`,
};

// Static shell: all mission state is read on the client from browser storage.
export default function MissionPage() {
  return (
    <AppShell>
      <MissionScreen />
    </AppShell>
  );
}

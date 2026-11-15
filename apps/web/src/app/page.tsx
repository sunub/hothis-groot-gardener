import { AppShell } from '@/components/app-shell';
import { StartScreen } from '@/features/grow-room/start-screen';

export default function HomePage() {
  return (
    <AppShell>
      <StartScreen />
    </AppShell>
  );
}

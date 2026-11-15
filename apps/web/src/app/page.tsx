import { AppShell } from '@/components/app-shell';
import { LandingScreen } from '@/features/grow-room/landing-screen';

export default function HomePage() {
  return (
    <AppShell wide>
      <LandingScreen />
    </AppShell>
  );
}

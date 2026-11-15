import { AppShell } from '@/components/app-shell';
import { StartScreen } from '@/features/grow-room/start-screen';

/** 팀 시작 화면. 맨 앞 주소(/)는 public/play의 프론트엔드가 쓰므로 여기로 옮겼다. */
export default function StartPage() {
  return (
    <AppShell>
      <StartScreen />
    </AppShell>
  );
}

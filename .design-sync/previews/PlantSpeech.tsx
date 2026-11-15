import { SpeechBubble } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[28rem] flex-col gap-10 bg-bg p-8 text-ink">{children}</div>
);

export const TailLeft = () => (
  <Stage>
    <div className="pl-4"><SpeechBubble tail="left">My leaf tips keep getting wet drops on them.</SpeechBubble></div>
  </Stage>
);

export const TailTop = () => (
  <Stage>
    <div className="pt-4"><SpeechBubble tail="top">Roots and air both feel comfortable today.</SpeechBubble></div>
  </Stage>
);

export const TailBottom = () => (
  <Stage>
    <div className="pb-4"><SpeechBubble tail="bottom">The air feels heavy.</SpeechBubble></div>
  </Stage>
);

export const NoTail = () => (
  <Stage>
    <SpeechBubble tail="none">Good night. I will rest under the dim lights.</SpeechBubble>
  </Stage>
);

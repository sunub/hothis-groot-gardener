import { PlantSpeech } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[28rem] flex-col gap-10 bg-bg p-8 text-ink">{children}</div>
);

// Tail under the bubble: the bubble hangs above the plant in the grow-room scene.
export const TailDown = () => (
  <Stage>
    <div className="pb-6 text-body">
      <PlantSpeech text="My leaf tips keep getting wet drops on them." />
    </div>
  </Stage>
);

// Tail on top: the bubble sits under the picture (narrow screens, event card).
export const TailUp = () => (
  <Stage>
    <PlantSpeech tail="up" className="text-body" text="Roots and air both feel comfortable today." />
  </Stage>
);

// The landing artboard draws it at 25px; every size follows the font size.
export const Large = () => (
  <Stage>
    <div className="pb-8 text-[25px]">
      <PlantSpeech text="Look after me from sowing to harvest." />
    </div>
  </Stage>
);

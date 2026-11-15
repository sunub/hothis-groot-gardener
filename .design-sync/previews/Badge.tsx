import { Badge } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3 bg-bg p-6 text-ink">{children}</div>
);

export const Tones = () => (
  <Stage>
    <Badge tone="normal">✓ Normal</Badge>
    <Badge tone="caution">△ Caution · high</Badge>
    <Badge tone="danger">✕ Danger · low</Badge>
    <Badge tone="measured">Recorded</Badge>
    <Badge tone="game">Game value</Badge>
    <Badge tone="accent">Day 3</Badge>
    <Badge tone="neutral">Growth</Badge>
  </Stage>
);

export const Solid = () => (
  <Stage>
    <Badge tone="caution" appearance="solid">Crisis continues</Badge>
    <Badge tone="measured" appearance="solid">Recorded</Badge>
    <Badge tone="accent" appearance="solid">Harvest</Badge>
  </Stage>
);

export const Dashed = () => (
  <Stage>
    <Badge tone="game" appearance="dashed">Game value</Badge>
  </Stage>
);

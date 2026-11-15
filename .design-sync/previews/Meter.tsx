import { Meter } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[28rem] flex-col gap-3 bg-bg p-6 text-ink">{children}</div>
);

export const Tones = () => (
  <Stage>
    <Meter value={78} tone="health" aria-label="Plant health" />
    <Meter value={45} tone="water" aria-label="Root moisture" />
    <Meter value={70} tone="humidity" aria-label="Chamber humidity" />
    <Meter value={55} tone="micro" aria-label="Microbial load" />
    <Meter value={30} tone="caution" aria-label="Caution level" />
    <Meter value={12} tone="danger" aria-label="Danger level" />
  </Stage>
);

export const Sizes = () => (
  <Stage>
    <Meter value={60} tone="health" size="sm" aria-label="Small" />
    <Meter value={60} tone="health" size="md" aria-label="Medium" />
    <Meter value={60} tone="health" size="lg" aria-label="Large" />
  </Stage>
);

export const Range = () => (
  <Stage>
    <Meter value={3} min={1} max={7} tone="accent" aria-label="Game day 3 of 7" />
  </Stage>
);

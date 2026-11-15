import { Callout } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[34rem] flex-col gap-3 bg-bg p-6 text-ink">{children}</div>
);

export const Tones = () => (
  <Stage>
    <Callout tone="caution">Within the range does not mean safe. Read each value in its zone.</Callout>
    <Callout tone="danger">The crisis could not be saved. Check the report for what happened.</Callout>
    <Callout tone="measured">Recorded in NASA plant growth tests: leaf tip burn at high humidity.</Callout>
    <Callout tone="normal">All values are in the normal zone.</Callout>
    <Callout tone="accent">Day 1 is sowing day. There is daily care only, no crisis.</Callout>
    <Callout tone="neutral">The app records no health data about people.</Callout>
  </Stage>
);

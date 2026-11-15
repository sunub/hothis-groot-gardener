import { Card, CardTitle } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="grid w-[40rem] grid-cols-2 gap-4 bg-bg p-6 text-ink">{children}</div>
);

export const Tones = () => (
  <Stage>
    <Card><CardTitle>Plant status</CardTitle><p className="mt-2 text-body text-ink-muted">Default frame.</p></Card>
    <Card tone="accent"><CardTitle>Daily care</CardTitle><p className="mt-2 text-body text-ink-muted">Current step.</p></Card>
    <Card tone="caution"><CardTitle>Crisis</CardTitle><p className="mt-2 text-body text-ink-muted">Needs a decision.</p></Card>
    <Card tone="danger"><CardTitle>Mission failed</CardTitle><p className="mt-2 text-body text-ink-muted">Plant health reached 0.</p></Card>
    <Card tone="normal"><CardTitle>Harvest ready</CardTitle><p className="mt-2 text-body text-ink-muted">All values normal.</p></Card>
    <Card tone="measured"><CardTitle>Recorded data</CardTitle><p className="mt-2 text-body text-ink-muted">From a source.</p></Card>
  </Stage>
);

export const Padding = () => (
  <Stage>
    <Card padding="sm"><p className="text-body">Small padding</p></Card>
    <Card padding="md"><p className="text-body">Medium padding</p></Card>
  </Stage>
);

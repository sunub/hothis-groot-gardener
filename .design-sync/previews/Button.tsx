import { Button } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3 bg-bg p-6 text-ink">{children}</div>
);

export const Variants = () => (
  <Stage>
    <Button variant="primary">End day</Button>
    <Button variant="secondary">Reset day</Button>
    <Button variant="danger">Replace saved mission</Button>
    <Button variant="ghost">Skip intro</Button>
  </Stage>
);

export const Sizes = () => (
  <Stage>
    <Button variant="primary" size="sm">Small</Button>
    <Button variant="primary" size="md">Medium</Button>
    <Button variant="primary" size="lg">Large</Button>
  </Stage>
);

export const ToggleGroup = () => (
  <Stage>
    <Button variant="toggle" aria-pressed={true}>Low</Button>
    <Button variant="toggle" aria-pressed={false}>High</Button>
  </Stage>
);

export const Disabled = () => (
  <Stage>
    <Button variant="primary" disabled>Normal +10</Button>
    <Button variant="secondary" disabled>Heavy +20</Button>
  </Stage>
);

export const Block = () => (
  <div className="w-96 bg-bg p-6 text-ink">
    <Button variant="primary" block>Confirm choice</Button>
  </div>
);

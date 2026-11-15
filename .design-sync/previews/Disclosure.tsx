import { Badge, Disclosure } from 'space-garden-ui';

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[34rem] flex-col gap-1 bg-bg p-6 text-ink">{children}</div>
);

export const Closed = () => (
  <Stage>
    <Disclosure summary="Source: NASA Veggie plant growth test" trailing={<Badge tone="measured" appearance="solid">Recorded</Badge>}>
      <p className="text-body text-ink-muted">Quote and link appear here when opened.</p>
    </Disclosure>
  </Stage>
);

export const Open = () => (
  <Stage>
    <Disclosure open summary="Source: NASA Veggie plant growth test" trailing={<Badge tone="measured" appearance="solid">Recorded</Badge>}>
      <p className="text-body text-ink-muted">“Lettuce leaves showed tip burn when humidity stayed high.”</p>
      <p className="font-data text-data-sm text-measured">ntrs.nasa.gov/citations</p>
    </Disclosure>
  </Stage>
);

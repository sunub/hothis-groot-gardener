import { Card, CardTitle } from 'space-garden-ui';

export const Title = () => (
  <div className="w-[26rem] bg-bg p-6 text-ink">
    <Card>
      <CardTitle>Cabin status</CardTitle>
      <p className="mt-2 text-body text-ink-muted">Root moisture and humidity, read this morning.</p>
    </Card>
  </div>
);

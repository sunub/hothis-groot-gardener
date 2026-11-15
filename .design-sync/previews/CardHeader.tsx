import { Badge, Card, CardHeader, CardTitle } from 'space-garden-ui';

export const WithBadge = () => (
  <div className="w-[28rem] bg-bg p-6 text-ink">
    <Card>
      <CardHeader>
        <CardTitle>Status history</CardTitle>
        <Badge tone="game" appearance="dashed">Game value</Badge>
      </CardHeader>
      <p className="text-body text-ink-muted">One point per game day, read each morning.</p>
    </Card>
  </div>
);

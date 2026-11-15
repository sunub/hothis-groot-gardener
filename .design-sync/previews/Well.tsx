import { Card, CardTitle, Well } from 'space-garden-ui';

export const StatTiles = () => (
  <div className="w-[34rem] bg-bg p-6 text-ink">
    <Card>
      <CardTitle>Overnight changes</CardTitle>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Well>
          <div className="text-body text-ink-muted">Root moisture</div>
          <div className="font-data text-data-lg">−10 overnight</div>
        </Well>
        <Well>
          <div className="text-body text-ink-muted">Chamber humidity</div>
          <div className="font-data text-data-lg">+5 overnight</div>
        </Well>
      </div>
    </Card>
  </div>
);

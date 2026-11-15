import { Card, CardDescription, CardHeader, CardTitle } from 'space-garden-ui';

export const Description = () => (
  <div className="w-[26rem] bg-bg p-6 text-ink">
    <Card>
      <CardHeader>
        <CardTitle>Overnight</CardTitle>
      </CardHeader>
      <CardDescription>Values change once each night. Plant health is checked after the change.</CardDescription>
    </Card>
  </div>
);

import { Card, Skeleton } from 'space-garden-ui';

export const Loading = () => (
  <div className="w-[26rem] bg-bg p-6 text-ink">
    <Card>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </Card>
  </div>
);

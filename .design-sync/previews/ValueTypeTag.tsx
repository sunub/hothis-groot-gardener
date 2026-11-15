import { ValueTypeTag } from 'space-garden-ui';

export const Both = () => (
  <div className="flex items-center gap-4 bg-bg p-6 text-ink">
    <ValueTypeTag type="measured" />
    <ValueTypeTag type="game_value" />
  </div>
);

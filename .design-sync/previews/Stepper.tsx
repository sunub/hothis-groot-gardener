import { Stepper } from 'space-garden-ui';

const labels = { done: 'Done', current: 'Now', upcoming: 'Next' };

export const Harvest = () => (
  <div className="w-[40rem] bg-bg p-6 text-ink">
    <Stepper
      stateLabels={labels}
      steps={[
        { id: 'harvest', index: '1', label: 'Harvest', state: 'done' },
        { id: 'freeze', index: '2', label: 'Freeze samples', state: 'current' },
        { id: 'report', index: '3', label: 'Ground report', state: 'upcoming' },
      ]}
    />
  </div>
);

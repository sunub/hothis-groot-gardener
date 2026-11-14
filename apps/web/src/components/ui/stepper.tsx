import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type StepState = 'done' | 'current' | 'upcoming';

export interface Step {
  id: string;
  /** Short number or code, e.g. "6". */
  index: string;
  label: string;
  state: StepState;
  /** Decorative icon, e.g. <PixelIcon name="earth" />. */
  icon?: ReactNode;
}

const stateClass: Record<StepState, string> = {
  done: 'bg-surface text-normal pixel-tone-normal',
  current: 'bg-accent text-accent-ink pixel-tone-dark',
  upcoming: 'bg-surface text-ink-faint pixel-tone-line',
};

/**
 * A short sequence of steps with connectors, such as harvest → freeze → ground report.
 * `stateLabels` gives the words for each state ("Done", "Now", "Next") so the state is not shown by color alone.
 */
export function Stepper({
  steps,
  stateLabels,
  className,
  ...props
}: ComponentProps<'ol'> & { steps: readonly Step[]; stateLabels: Record<StepState, string> }) {
  return (
    <ol className={cn('flex items-center', className)} {...props}>
      {steps.map((step, i) => (
        <li
          key={step.id}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="flex flex-1 items-center gap-2"
        >
          <div className={cn('m-1 flex items-center gap-2 pixel-frame-flat px-3 py-1.5', stateClass[step.state])}>
            {step.icon}
            <span className="flex flex-col">
              <span className="font-data text-data-sm">
                {step.index} · {stateLabels[step.state]}
              </span>
              <span className="text-caption">{step.label}</span>
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span aria-hidden className={cn('h-1 flex-1', step.state === 'done' ? 'bg-normal' : 'bg-line')} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

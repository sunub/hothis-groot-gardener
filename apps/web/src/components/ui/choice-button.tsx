import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ChoiceButtonProps = ComponentProps<'button'> & {
  /** Letter in the key box, e.g. "A". */
  keyLabel: string;
  /** Picked but not confirmed, or the confirmed choice after the result is shown. */
  selected?: boolean;
  /** Not chosen, after the result is shown. */
  dimmed?: boolean;
  /** Right-aligned note such as "✓ Selected". */
  trailing?: ReactNode;
};

/**
 * One option of a crisis or event. Large, left-aligned, with a key box.
 * It shows only the label: verdicts are never passed to this component.
 */
export function ChoiceButton({
  keyLabel,
  selected = false,
  dimmed = false,
  trailing,
  className,
  children,
  type = 'button',
  ...props
}: ChoiceButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'm-1 flex min-h-14 w-full cursor-pointer items-center gap-4 pixel-frame bg-surface px-4 py-3 text-left font-title text-control text-ink',
        selected ? 'pixel-tone-accent' : 'pixel-tone-line hover:pixel-tone-line-hi',
        dimmed && 'opacity-55',
        'disabled:cursor-default disabled:hover:pixel-tone-line',
        selected && 'disabled:hover:pixel-tone-accent',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center font-data text-data',
          selected ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink',
        )}
      >
        {keyLabel}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {trailing ? <span className="shrink-0 text-caption font-bold text-accent">{trailing}</span> : null}
    </button>
  );
}

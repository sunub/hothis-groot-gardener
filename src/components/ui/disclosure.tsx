import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Folding section built on <details>, so it works without JavaScript and with the keyboard.
 * Used for sources: one summary line, the quote and link inside.
 */
export function Disclosure({
  summary,
  trailing,
  className,
  children,
  ...props
}: Omit<ComponentProps<'details'>, 'children'> & {
  summary: ReactNode;
  /** Shown at the right end of the summary line, e.g. a Recorded badge. */
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className={cn('group m-1 pixel-frame-flat pixel-tone-line bg-surface-2', className)} {...props}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-body [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span aria-hidden className="font-data text-data-sm group-open:hidden">
            ▸
          </span>
          <span aria-hidden className="hidden font-data text-data-sm group-open:inline">
            ▾
          </span>
          {summary}
        </span>
        {trailing}
      </summary>
      <div className="space-y-2 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}

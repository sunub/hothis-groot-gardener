import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/** Placeholder block shown while content loads. Blinks in steps, not with a smooth pulse. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('h-4 animate-blink bg-surface-2', className)} {...props} />;
}

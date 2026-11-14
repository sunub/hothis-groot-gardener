import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

type Tail = 'left' | 'top' | 'bottom' | 'none';

/**
 * The plant NPC's speech bubble. Light fill and a dark frame; no other text uses this shape.
 * The tail is two stacked triangles: a dark outline and a light fill.
 */
export function SpeechBubble({
  tail = 'left',
  className,
  children,
  ...props
}: ComponentProps<'div'> & { tail?: Tail }) {
  return (
    <div className={cn('relative m-1 pixel-bubble px-4 py-3 text-body', className)} {...props}>
      {tail === 'left' ? (
        <>
          <span
            aria-hidden
            className="absolute top-4 -left-4 size-0 border-y-8 border-r-12 border-y-transparent border-r-bg"
          />
          <span
            aria-hidden
            className="absolute top-4 -left-2.5 size-0 border-y-8 border-r-12 border-y-transparent border-r-ink"
          />
        </>
      ) : null}
      {tail === 'top' ? (
        <>
          <span
            aria-hidden
            className="absolute -top-4 left-6 size-0 border-x-8 border-b-12 border-x-transparent border-b-bg"
          />
          <span
            aria-hidden
            className="absolute -top-2.5 left-6 size-0 border-x-8 border-b-12 border-x-transparent border-b-ink"
          />
        </>
      ) : null}
      {tail === 'bottom' ? (
        <>
          <span
            aria-hidden
            className="absolute -bottom-4 left-6 size-0 border-x-8 border-t-12 border-x-transparent border-t-bg"
          />
          <span
            aria-hidden
            className="absolute -bottom-2.5 left-6 size-0 border-x-8 border-t-12 border-x-transparent border-t-ink"
          />
        </>
      ) : null}
      {children}
    </div>
  );
}

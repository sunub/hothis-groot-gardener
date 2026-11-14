import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Notice with a 4px bar on its left edge. Used for standing warnings
 * ("Within the range does not mean safe"), recorded-data boxes and error messages.
 */
export const calloutVariants = cva('flex items-start gap-3 bg-surface-2 px-4 py-3 pixel-bar text-body', {
  variants: {
    tone: {
      caution: 'pixel-tone-caution',
      danger: 'pixel-tone-danger',
      measured: 'pixel-tone-measured',
      normal: 'pixel-tone-normal',
      accent: 'pixel-tone-accent',
      neutral: 'pixel-tone-line',
    },
  },
  defaultVariants: {
    tone: 'caution',
  },
});

export type CalloutProps = ComponentProps<'div'> &
  VariantProps<typeof calloutVariants> & {
    /** Decorative icon shown before the text, e.g. <PixelIcon name="info" />. */
    icon?: ReactNode;
  };

export function Callout({ tone, icon, className, children, ...props }: CalloutProps) {
  return (
    <div className={cn(calloutVariants({ tone }), className)} {...props}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

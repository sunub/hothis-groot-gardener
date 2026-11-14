import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Panel with a notched pixel frame. The frame tone marks what the panel is about:
 * accent for the current step, caution or danger for warnings, measured for recorded data.
 */
export const cardVariants = cva('m-1 min-w-0 pixel-frame bg-surface', {
  variants: {
    tone: {
      default: 'pixel-tone-line',
      accent: 'pixel-tone-accent',
      normal: 'pixel-tone-normal',
      caution: 'pixel-tone-caution',
      danger: 'pixel-tone-danger',
      measured: 'pixel-tone-measured',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-5 sm:p-6',
    },
  },
  defaultVariants: {
    tone: 'default',
    padding: 'md',
  },
});

export type CardProps = ComponentProps<'section'> & VariantProps<typeof cardVariants>;

export function Card({ tone, padding, className, ...props }: CardProps) {
  return <section className={cn(cardVariants({ tone, padding }), className)} {...props} />;
}

/** Title row: title on the left, badges or actions on the right. */
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('font-title text-heading font-bold text-ink', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-caption text-ink-muted', className)} {...props} />;
}

/** Plain raised area inside a panel (stat tiles, quotes). No frame. */
export function Well({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('bg-surface-2 px-4 py-3', className)} {...props} />;
}

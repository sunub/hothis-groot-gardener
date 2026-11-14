import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/** Filled bar cut into 8px blocks. Pass aria-label (or aria-labelledby) for the meter's name. */
export const meterFillVariants = cva('h-full transition-[width] duration-500 motion-reduce:transition-none', {
  variants: {
    tone: {
      health: 'bg-health',
      water: 'bg-water',
      humidity: 'bg-humidity',
      micro: 'bg-micro',
      accent: 'bg-accent',
      measured: 'bg-measured',
      caution: 'bg-caution',
      danger: 'bg-danger-fill',
    },
  },
  defaultVariants: {
    tone: 'accent',
  },
});

const trackSize = {
  sm: 'h-4',
  md: 'h-5',
  lg: 'h-7',
} as const;

export type MeterProps = Omit<ComponentProps<'div'>, 'children'> &
  VariantProps<typeof meterFillVariants> & {
    value: number;
    min?: number;
    max?: number;
    size?: keyof typeof trackSize;
  };

export function Meter({ value, min = 0, max = 100, tone, size = 'md', className, ...props }: MeterProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const percent = max === min ? 0 : ((clamped - min) / (max - min)) * 100;
  return (
    <div
      role="meter"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      className={cn('m-1 bg-bg pixel-frame-flat pixel-tone-line', trackSize[size], className)}
      {...props}
    >
      <div className={cn(meterFillVariants({ tone }), 'pixel-segments')} style={{ width: `${percent}%` }} />
    </div>
  );
}

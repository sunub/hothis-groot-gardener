import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export type Tone = 'normal' | 'caution' | 'danger' | 'measured' | 'game' | 'accent' | 'neutral';

/**
 * Small label set in VT323. The tone picks a color, the appearance picks a shape:
 * - soft: tinted fill and colored text (zones, verdicts, grades)
 * - solid: full fill and dark text (the "Recorded" badge, phase tags)
 * - dashed: dashed frame (the "Game value" badge only)
 *
 * The tone sets a --tone variable so each appearance can reuse it.
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-2 px-2 py-0.5 font-data text-data-sm leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        normal: '[--tone:var(--color-normal)]',
        caution: '[--tone:var(--color-caution)]',
        danger: '[--tone:var(--color-danger)]',
        measured: '[--tone:var(--color-measured)]',
        game: '[--tone:var(--color-game)]',
        accent: '[--tone:var(--color-accent)]',
        neutral: '[--tone:var(--color-ink-muted)]',
      } satisfies Record<Tone, string>,
      appearance: {
        soft: 'bg-(--tone)/15 text-(--tone)',
        solid: 'bg-(--tone) text-bg',
        dashed: 'pixel-dashed bg-surface text-ink-muted',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      appearance: 'soft',
    },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ tone, appearance, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, appearance }), className)} {...props} />;
}

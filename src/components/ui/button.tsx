import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Button styles. Exported so links can look like buttons:
 * `<Link className={buttonVariants({ variant: 'primary' })} />`.
 *
 * - primary: the one main action of a panel (raised mint).
 * - secondary: other actions (framed slate).
 * - danger: destructive actions such as replacing a saved mission.
 * - toggle: one of a group; set `aria-pressed` to show the selected one.
 * - ghost: low-emphasis text action.
 *
 * Every variant keeps a 44px minimum touch target and carries 4px outer margin for the frame.
 */
export const buttonVariants = cva(
  [
    'm-1 inline-flex items-center justify-center gap-2 font-title font-medium whitespace-nowrap select-none',
    'cursor-pointer disabled:cursor-not-allowed',
  ],
  {
    variants: {
      variant: {
        primary: [
          'pixel-raised font-bold',
          'active:pixel-pressed',
          'disabled:bg-surface disabled:text-ink-faint disabled:pixel-frame-flat disabled:pixel-tone-line',
        ],
        secondary: [
          'pixel-frame pixel-tone-line bg-surface-2 text-ink',
          'hover:pixel-tone-line-hi',
          'disabled:bg-surface disabled:text-ink-faint disabled:hover:pixel-tone-line',
        ],
        danger: [
          'pixel-frame-flat pixel-tone-danger bg-surface-2 text-danger',
          'hover:bg-danger/10',
          'disabled:text-ink-faint disabled:pixel-tone-line',
        ],
        toggle: [
          'pixel-frame-flat pixel-tone-line bg-surface-2 text-ink',
          'hover:pixel-tone-line-hi',
          'aria-pressed:bg-accent aria-pressed:font-bold aria-pressed:text-accent-ink aria-pressed:pixel-tone-dark',
          'disabled:text-ink-faint',
        ],
        ghost: ['text-ink-muted underline-offset-4 hover:text-ink hover:underline', 'disabled:text-ink-faint'],
      },
      size: {
        sm: 'min-h-11 px-4 text-body',
        md: 'min-h-12 px-6 text-control',
        lg: 'min-h-13 px-8 text-control',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ variant, size, block, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

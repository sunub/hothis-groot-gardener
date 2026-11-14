import type { ComponentProps } from 'react';

export type Tone = 'normal' | 'caution' | 'danger' | 'measured' | 'game' | 'neutral';

const tones: Record<Tone, string> = {
  normal: 'border-normal/40 bg-normal/10 text-normal',
  caution: 'border-caution/40 bg-caution/10 text-caution',
  danger: 'border-danger/40 bg-danger/10 text-danger',
  measured: 'border-measured/40 bg-measured/10 text-measured',
  game: 'border-game/40 bg-game/10 text-game',
  neutral: 'border-line bg-surface-2 text-ink-muted',
};

export function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

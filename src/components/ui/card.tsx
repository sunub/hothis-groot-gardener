import type { ComponentProps } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}
      {...props}
    />
  );
}

export function CardTitle({ className = '', ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={`text-sm font-semibold tracking-wide text-ink-muted uppercase ${className}`}
      {...props}
    />
  );
}

'use client';

import { useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * Tab row. Each tab looks like the `toggle` button (flat frame; the selected one
 * is filled with accent). Follows the ARIA tabs pattern: only the selected tab is
 * in the Tab order, Left/Right move between tabs, Home/End jump to the ends.
 * Pair every tab with a <TabPanel> that has the same `idPrefix` and value.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the tab row. */
  label: string;
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap', className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'm-1 inline-flex min-h-9 cursor-pointer items-center justify-center px-4 font-title text-control font-medium whitespace-nowrap select-none',
              'pixel-frame-flat pixel-tone-line bg-surface-2 text-ink-muted hover:pixel-tone-line-hi hover:text-ink',
              'aria-selected:bg-accent aria-selected:font-bold aria-selected:text-accent-ink aria-selected:pixel-tone-dark',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Content of one tab. Hidden (not unmounted) while another tab is selected. */
export function TabPanel({
  idPrefix,
  value,
  selected,
  className,
  ...props
}: ComponentProps<'div'> & { idPrefix: string; value: string; selected: boolean }) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn('focus-visible:outline-offset-4', className)}
      {...props}
    />
  );
}

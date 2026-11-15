'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';

/** Drawer width in px. The open tab sits on the drawer's left edge, so both use it. */
const DRAWER_WIDTH = 380;
/** Tab width in px: the drawer never grows past the screen minus the tab, so the tab stays reachable. */
const TAB_WIDTH = 44;

const noSubscribe = () => () => {};
/** False on the server and in the first client render, true after: document.body exists. */
function useMounted(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * The cultivation diary as a drawer on the right edge (design proposal B):
 * a vertical tab stays at the edge and opens the drawer; the open tab moves
 * with the drawer's edge and closes it again. Opening dims the screen behind.
 * Escape, the close button, the tab and the dimmed area all close it, and
 * focus goes into the drawer on open and back to the tab on close. A closed
 * drawer is hidden from the keyboard and screen readers.
 */
export function DiaryDrawer({ children }: { children: ReactNode }) {
  const t = useDictionary();
  const d = t.mission.diary;
  const [open, setOpen] = useState(false);
  const id = useId();
  const tabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus returns to the tab only after the drawer was open, not on the first render.
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      tabRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Once mounted, rendered straight into <body>: inside the page, a parent's space-y-*
  // gave the fixed backdrop and drawer a bottom margin and they stopped short of the
  // screen's bottom. In <body> no parent can shrink them; m-0 stays as a second guard.
  // The server and hydration render it in place (same markup, no body to portal into).
  const mounted = useMounted();
  const layers = (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-20 m-0 bg-bg/60 motion-safe:transition-opacity motion-safe:duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/*
        One box slides: the tab is its child, hanging off its left edge, so the
        tab and the drawer cannot drift apart while they move. Closed, the box
        sits just off the screen and only the tab stays in view.
      */}
      <div
        style={{ width: DRAWER_WIDTH, maxWidth: `calc(100vw - ${TAB_WIDTH}px)` }}
        className={cn(
          'fixed inset-y-0 right-0 z-30 m-0 motion-safe:transition-transform motion-safe:duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <button
          ref={tabRef}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? d.close : d.open}
          onClick={() => setOpen((v) => !v)}
          style={{ width: TAB_WIDTH, left: -TAB_WIDTH }}
          className="absolute top-48 flex h-56 flex-col items-center justify-center gap-3 rounded-l-[4px] bg-accent px-2 py-4 font-bold text-accent-ink"
        >
          <HistoryIcon />
          <span className="whitespace-nowrap py-1 text-body [writing-mode:vertical-rl]">{d.title}</span>
          <span aria-hidden>{open ? '▸' : '◂'}</span>
        </button>

        <aside
          id={id}
          aria-label={d.title}
          // A closed drawer must not take focus or be read out; `inert` covers both.
          inert={!open}
          className={cn(
            'flex h-full flex-col gap-3 overflow-y-auto border-l-4 border-accent bg-surface p-5',
            'motion-safe:transition-[visibility] motion-safe:duration-200',
            open ? 'visible' : 'invisible',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-heading font-bold">
              <HistoryIcon />
              {d.title}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center border border-line-hi px-3 text-caption"
            >
              {d.close} <span aria-hidden>✕</span>
            </button>
          </div>
          {children}
        </aside>
      </div>
    </>
  );
  return mounted ? createPortal(layers, document.body) : layers;
}

/** Clock with a back arrow: "history". */
function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

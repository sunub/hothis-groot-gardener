'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import './landing.css';

/**
 * Parts drawn in the scene's own visual language (scene tokens, lp-* classes in
 * landing.css): the monitor-style popup and the numbered step list on monitor
 * glass. Page UI keeps using components/ui; these are only for the grow-room scene.
 */

/** Numbered steps on monitor glass. */
export function SceneSteps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="lp-steps">
      {steps.map((step, i) => (
        <li key={step.title} className="lp-step">
          <span className="lp-n" aria-hidden>
            {i + 1}
          </span>
          <div>
            <b>{step.title}</b>
            <span>{step.body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Popup framed like a scene monitor. Escape and a click on the backdrop close it.
 * While it is open, Tab stays inside it and the page behind does not scroll; when
 * it closes, focus goes back to where it was.
 */
export function SceneModal({
  labelledBy,
  state,
  onClose,
  children,
}: {
  labelledBy: string;
  state: 'open' | 'closing';
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Layout effect: it runs before AutoFocusButton's effect moves focus into the
  // popup, so `opener` is still the element that opened it.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = ref.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={cn('lp lp-modal-bg', state === 'open' ? 'lp-in' : 'lp-out')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lp-modal">{children}</div>
    </div>
  );
}

/** Scene button that takes focus when it mounts (the safe choice in a popup). */
export function AutoFocusButton({
  className,
  onClick,
  children,
}: {
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <button ref={ref} type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

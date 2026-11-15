'use client';

import { useEffect, useRef, type ReactNode } from 'react';
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

/** Popup framed like a scene monitor. Escape and a click on the backdrop close it. */
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
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

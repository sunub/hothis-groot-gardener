'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';
import { useReducedMotion } from '@/lib/utils/use-reduced-motion';

type Props = Omit<ComponentProps<'div'>, 'children'> & {
  /** The line. It types itself whenever it changes; null shows an empty bubble. */
  text: string | null;
  /** down: tail under the bubble (bubble above the plant). up: tail on top (bubble under the picture). */
  tail?: 'down' | 'up';
  /** Runs once each line is fully shown (typed out, skipped by a click, or shown at once under reduced motion). */
  onTyped?: () => void;
};

/**
 * The plant's speech bubble, the same on every screen. Light fill, dark frame,
 * a typewriter line with a blinking caret. Clicking it shows the whole line at
 * once. It is not a control: the cursor stays plain and the text can't be
 * selected or dragged. Screen readers get the whole line, never the partial one.
 */
export function PlantSpeech({ text, tail = 'down', onTyped, className, onClick, ...props }: Props) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState<{ text: string | null; shown: number; caret: boolean }>({
    text,
    shown: 0,
    caret: text !== null,
  });
  // A new line starts empty with the caret (state adjusted while rendering, not in an effect).
  if (progress.text !== text) setProgress({ text, shown: 0, caret: text !== null });
  const onTypedRef = useRef(onTyped);
  useEffect(() => {
    onTypedRef.current = onTyped;
  });
  const skip = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!text) return;
    const total = [...text].length;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      onTypedRef.current?.();
    };
    if (reduced) {
      done();
      return;
    }
    const timers: number[] = [];
    const step = Math.min(35, Math.max(12, 900 / total));
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setProgress({ text, shown: i, caret: true });
      if (i >= total) {
        window.clearInterval(id);
        timers.push(
          window.setTimeout(() => setProgress((cur) => (cur.text === text ? { ...cur, caret: false } : cur)), 700),
          window.setTimeout(done, 450),
        );
      }
    }, step);
    skip.current = () => {
      window.clearInterval(id);
      setProgress({ text, shown: total, caret: false });
      done();
    };
    return () => {
      window.clearInterval(id);
      timers.forEach((t) => window.clearTimeout(t));
      skip.current = null;
    };
  }, [text, reduced]);

  const chars = text ? [...text] : [];
  // Reduced motion shows the whole line at once, without the caret.
  const shown = reduced ? chars.length : progress.shown;
  const caret = !reduced && progress.caret;

  return (
    <div
      // A new line pops the bubble again.
      key={text ?? ''}
      data-tail={tail}
      className={cn('plant-speech', !reduced && 'plant-speech-pop', className)}
      onClick={(event) => {
        skip.current?.();
        onClick?.(event);
      }}
      {...props}
    >
      {text ? (
        <>
          <span className="sr-only">{text}</span>
          <span aria-hidden>
            {chars.slice(0, shown).join('')}
            {caret ? <span className="plant-speech-caret" /> : null}
            <span className="plant-speech-rest">{chars.slice(shown).join('')}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}

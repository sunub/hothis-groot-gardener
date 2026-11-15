import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge taught about this project's tokens (src/styles/tokens.css) and
 * pixel utilities (src/styles/utilities.css). Without this, `text-body` would be
 * read as a text color and would remove `text-ink`, and two frame classes would
 * both stay on the element.
 */
const twMerge = extendTailwindMerge<'pixel-frame' | 'pixel-tone'>({
  extend: {
    theme: {
      text: ['caption', 'body', 'control', 'heading', 'display', 'data-sm', 'data', 'data-lg', 'data-xl'],
    },
    classGroups: {
      'pixel-frame': [
        'pixel-frame',
        'pixel-frame-flat',
        'pixel-frame-thin',
        'pixel-raised',
        'pixel-pressed',
        'pixel-bar',
      ],
      'pixel-tone': [
        { 'pixel-tone': ['line', 'line-hi', 'accent', 'normal', 'caution', 'danger', 'measured', 'dark'] },
      ],
    },
  },
});

/** Join class names; later Tailwind classes win over earlier ones in the same group. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

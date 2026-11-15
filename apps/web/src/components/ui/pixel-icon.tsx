import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

/** The twelve icons in public/icons. */
export const PIXEL_ICONS = [
  'earth',
  'fail',
  'fan',
  'half',
  'info',
  'ok',
  'pruner',
  'scope',
  'sprout',
  'syringe',
  'water',
  'wipe',
] as const;

export type PixelIconName = (typeof PIXEL_ICONS)[number];

const sizes = {
  sm: 'size-6',
  md: 'size-9',
  lg: 'size-14',
  xl: 'size-16',
} as const;

/**
 * A pixel-art icon. Decorative by default (empty alt): the text next to it carries the meaning.
 * Pass `alt` only when the icon stands alone.
 */
export function PixelIcon({
  name,
  size = 'md',
  alt = '',
  className,
  ...props
}: Omit<ComponentProps<'img'>, 'src'> & { name: PixelIconName; size?: keyof typeof sizes }) {
  return (
    // Fixed-size local pixel art: next/image would add smoothing and layout work for no gain.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/${name}.png`}
      alt={alt}
      draggable={false}
      className={cn('shrink-0 object-contain pixel-art', sizes[size], className)}
      {...props}
    />
  );
}

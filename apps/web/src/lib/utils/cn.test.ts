import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps a custom font size next to a text color', () => {
    expect(cn('text-body text-ink')).toBe('text-body text-ink');
  });

  it('lets a later custom font size replace an earlier one', () => {
    expect(cn('text-body', 'text-control')).toBe('text-control');
  });

  it('lets a later text color replace an earlier one', () => {
    expect(cn('text-ink', 'text-accent')).toBe('text-accent');
  });

  it('keeps one frame utility, the last one', () => {
    expect(cn('pixel-frame', 'pixel-raised')).toBe('pixel-raised');
  });

  it('keeps one frame tone, the last one, next to the frame', () => {
    expect(cn('pixel-frame pixel-tone-line', 'pixel-tone-danger')).toBe('pixel-frame pixel-tone-danger');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});

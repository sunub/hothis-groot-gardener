'use client';

import { Badge } from '@/components/ui/badge';
import type { ValueType } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';

/**
 * Marks a number or statement as recorded (from a source) or a game value.
 * The two differ by shape, not only color: recorded is a filled badge with ■,
 * a game value is a dashed badge with ◇.
 */
export function ValueTypeTag({ type, className }: { type: ValueType; className?: string }) {
  const t = useDictionary();
  const measured = type === 'measured';
  return (
    <Badge
      tone={measured ? 'measured' : 'game'}
      appearance={measured ? 'solid' : 'dashed'}
      title={t.common.value_type_help[type]}
      className={cn('shrink-0', className)}
    >
      <span aria-hidden className={cn('size-2', measured ? 'bg-bg' : 'border-2 border-current')} />
      {t.common.value_type[type]}
    </Badge>
  );
}

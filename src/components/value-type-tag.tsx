'use client';

import { Badge } from '@/components/ui/badge';
import type { ValueType } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';

/** Marks a number or statement as measured (from a source) or a game value. */
export function ValueTypeTag({ type }: { type: ValueType }) {
  const t = useDictionary();
  return (
    <Badge tone={type === 'measured' ? 'measured' : 'game'} title={t.common.value_type_help[type]}>
      {t.common.value_type[type]}
    </Badge>
  );
}

'use client';

import type { ReactNode } from 'react';
import { PixelIcon, type PixelIconName } from '@/components/ui/pixel-icon';
import type { Verdict } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';

/** Each verdict is told by frame color, icon and words together, never by color alone. */
const VERDICT_STYLE: Record<Verdict, { frame: string; text: string; icon: PixelIconName }> = {
  appropriate: { frame: 'pixel-tone-normal', text: 'text-normal', icon: 'ok' },
  partial: { frame: 'pixel-tone-caution', text: 'text-caution', icon: 'half' },
  inappropriate: { frame: 'pixel-tone-danger', text: 'text-danger', icon: 'fail' },
};

/** The verdict after a choice: large icon, the verdict word, and one line on what it means. */
export function VerdictBanner({
  verdict,
  detail,
  className,
}: {
  verdict: Verdict;
  /** One line under the verdict, e.g. "Crisis ends · related value moves to 55". */
  detail?: ReactNode;
  className?: string;
}) {
  const t = useDictionary();
  const style = VERDICT_STYLE[verdict];
  return (
    <div className={cn('m-1 flex items-center gap-4 pixel-frame bg-surface p-4', style.frame, className)}>
      <PixelIcon name={style.icon} size="lg" />
      <div className="flex min-w-0 flex-col">
        <span className={cn('font-title text-heading font-bold', style.text)}>{t.common.verdict[verdict]}</span>
        {detail ? <span className="text-body text-ink">{detail}</span> : null}
      </div>
    </div>
  );
}

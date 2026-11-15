'use client';

import { Badge } from '@/components/ui/badge';
import { ValueTypeTag } from '@/components/value-type-tag';
import { format, useDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';
import { TONE_SIGN, type DiaryLine } from './diary';

const TONE_CLASS = {
  positive: 'text-normal',
  negative: 'text-danger',
  mixed: 'text-caution',
  neutral: 'text-ink-muted',
} as const;

/**
 * The cultivation diary (재배 일지): one line per thing that happened, newest
 * first. Experiment lines are marked as recorded only when they were checked
 * against the original source; observation lines written from the plant's
 * state are marked as game values.
 */
export function CultivationDiary({
  lines,
  inDrawer = false,
}: {
  lines: readonly DiaryLine[];
  /** The drawer (diary-drawer.tsx) shows the title and scrolls, so the list drops both. */
  inDrawer?: boolean;
}) {
  const t = useDictionary();
  const d = t.mission.diary;

  return (
    <section aria-label={inDrawer ? d.title : undefined} aria-labelledby={inDrawer ? undefined : 'diary-title'} className="space-y-3">
      {inDrawer ? null : (
        <h3 id="diary-title" className="text-heading font-bold">
          {d.title}
        </h3>
      )}
      {lines.length === 0 ? (
        <p className="text-body text-ink-muted">{d.empty}</p>
      ) : (
        <ol
          tabIndex={0}
          aria-label={inDrawer ? d.title : undefined}
          aria-labelledby={inDrawer ? undefined : 'diary-title'}
          className={cn('divide-y-4 divide-surface bg-surface-2', !inDrawer && 'max-h-[32rem] overflow-y-auto')}
        >
          {lines.map((line, i) => (
            <li key={line.key} className={cn('flex gap-3 px-3 py-2', inDrawer && 'gap-4 px-4 py-4', i === 0 && 'sprite-pop')}>
              <span className="w-14 shrink-0 font-data text-data-sm text-ink-muted tabular-nums">
                {format(d.day, { day: line.day })}
              </span>
              <span className="min-w-0 flex-1 text-body">
                <LineText line={line} />
              </span>
              <span className={cn('w-4 shrink-0 text-right font-data text-data', TONE_CLASS[line.tone])}>
                <span aria-hidden>{TONE_SIGN[line.tone]}</span>
                {d.tone[line.tone] ? <span className="sr-only">{d.tone[line.tone]}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LineText({ line }: { line: DiaryLine }) {
  const t = useDictionary();
  const d = t.mission.diary;
  switch (line.kind) {
    case 'event':
      return line.name === null ? (
        <span className="font-semibold">{d.event_pending}</span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{format(d.event_done, { name: line.name })}</span>
          {line.verdict ? (
            <Badge tone={line.verdict === 'appropriate' ? 'normal' : line.verdict === 'partial' ? 'caution' : 'danger'}>
              {t.common.verdict[line.verdict]}
            </Badge>
          ) : null}
        </span>
      );
    case 'experiment':
      return (
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-data text-data-sm text-measured">{line.experiment}</span>
            {line.checked ? <ValueTypeTag type="measured" /> : <span className="text-caption text-ink-muted">{d.unchecked}</span>}
          </span>
          <span>{line.text}</span>
        </span>
      );
    case 'observation':
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span>{line.text}</span>
          {line.from_state ? <ValueTypeTag type="game_value" /> : null}
        </span>
      );
    case 'game_day':
      return <span className="font-data text-data-sm text-accent">{format(d.game_day, { game_day: line.game_day })}</span>;
    case 'zone':
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span>
            {format(d.zone, {
              metric: t.common.metric[line.metric],
              from: t.common.zone[line.from],
              to: t.common.zone[line.to],
            })}
          </span>
          <ValueTypeTag type="game_value" />
        </span>
      );
  }
}

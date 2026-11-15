import { ValueTypeTag } from '@/components/value-type-tag';
import type { ValueType } from '@/lib/contract/types';

export interface ChangeRow {
  key: string;
  label: string;
  /** Already formatted, e.g. "60 → 62" (a crisis) or "+2" (an event effect). */
  value: string;
  /** Shown muted: nothing changed. */
  unchanged?: boolean;
}

/**
 * "What changed" after a choice. A crisis passes before → after values; an
 * event card passes the effect of the action, so both read the same way.
 */
export function ChangeList({
  id,
  title,
  valueType,
  rows,
}: {
  /** id of the heading, unique on the page. */
  id: string;
  title: string;
  valueType: ValueType;
  rows: readonly ChangeRow[];
}) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-heading font-bold">
          {title}
        </h3>
        <ValueTypeTag type={valueType} />
      </div>
      <dl className="divide-y-4 divide-surface bg-surface-2 text-body">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className={`font-data text-data tabular-nums ${row.unchanged ? 'text-ink-muted' : ''}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

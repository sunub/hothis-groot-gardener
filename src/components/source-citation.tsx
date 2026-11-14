'use client';

import type { SourceRef } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';

/** A source with its verbatim sentence. Shows a plain note when there is no source. */
export function SourceCitation({ source }: { source: SourceRef | null }) {
  const t = useDictionary();
  if (!source) {
    return <p className="text-xs text-ink-muted">{t.common.source.none}</p>;
  }
  return (
    <figure className="space-y-1 text-xs text-ink-muted">
      <blockquote className="border-l-2 border-measured/60 pl-3 text-ink italic">
        “{source.quote}”
      </blockquote>
      <figcaption>
        {t.common.source.label}:{' '}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-line underline-offset-2 hover:text-ink"
        >
          {source.title}
        </a>
        {source.license ? ` (${source.license})` : null}
        {source.note ? <span className="block">{source.note}</span> : null}
      </figcaption>
    </figure>
  );
}

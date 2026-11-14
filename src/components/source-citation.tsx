'use client';

import type { SourceRef } from '@/lib/contract/types';
import { useDictionary } from '@/lib/i18n';

/** A source with its verbatim sentence. Shows a plain note when there is no source. */
export function SourceCitation({ source }: { source: SourceRef | null }) {
  const t = useDictionary();
  if (!source) {
    return <p className="text-caption text-ink-muted">{t.common.source.none}</p>;
  }
  return (
    <figure className="space-y-2 text-caption text-ink-muted">
      <blockquote className="border-l-4 border-line pl-3 text-body text-ink-muted">“{source.quote}”</blockquote>
      <figcaption className="space-y-1">
        <span className="block text-ink">
          {t.common.source.label}: {source.title}
          {source.license ? ` (${source.license})` : null}
        </span>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="block font-data text-data-sm break-all text-measured underline-offset-4 hover:underline"
        >
          {source.url.replace(/^https?:\/\//, '')}
        </a>
        {source.note ? <span className="block">{source.note}</span> : null}
      </figcaption>
    </figure>
  );
}

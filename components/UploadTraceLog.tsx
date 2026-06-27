'use client';

import { useEffect, useRef } from 'react';
import { formatTraceTime, type TraceEntry, type TraceLevel } from '@/lib/upload-trace';

const LEVEL_STYLES: Record<TraceLevel, string> = {
  info: 'text-neutral-300',
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  dim: 'text-neutral-500',
};

const TAG_STYLES: Record<string, string> = {
  INIT: 'text-sky-400',
  XHR: 'text-violet-400',
  NET: 'text-cyan-400',
  FFMPEG: 'text-orange-400',
  PDS: 'text-fuchsia-400',
  OK: 'text-emerald-400',
  ERR: 'text-red-400',
  SYS: 'text-neutral-400',
};

type UploadTraceLogProps = {
  entries: TraceEntry[];
  active?: boolean;
};

export default function UploadTraceLog({ entries, active }: UploadTraceLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div
      data-testid="upload-trace"
      className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-[0_0_40px_-12px_rgba(255,255,255,0.08)]"
      aria-live="polite"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${active ? 'animate-pulse bg-emerald-400' : 'bg-neutral-600'}`}
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">
            Session trace
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-neutral-600">
          {entries.length} evt
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        <ol className="relative space-y-0">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              data-testid="upload-trace-line"
              className="upload-trace-line group relative grid grid-cols-[4.5rem_3rem_1fr] gap-x-2 py-1.5 pl-3"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-neutral-700 via-neutral-800 to-transparent"
                aria-hidden
              />
              <span className="tabular-nums text-neutral-600">{formatTraceTime(entry.at)}</span>
              <span className={TAG_STYLES[entry.tag] ?? 'text-neutral-500'}>[{entry.tag}]</span>
              <div className="min-w-0">
                <span className={LEVEL_STYLES[entry.level]}>{entry.message}</span>
                {entry.detail ? (
                  <p className="mt-0.5 break-all text-[10px] text-neutral-500">{entry.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
          <div ref={bottomRef} />
        </ol>
      </div>
    </div>
  );
}

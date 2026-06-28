'use client';

import { FormEvent, useState } from 'react';

type ReportButtonProps = {
  uri: string;
  context: string;
};

export default function ReportButton({ uri, context }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError(null);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, reason: reason.trim() || undefined, movement: context }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setStatus('done');
      setOpen(false);
      setReason('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid={`report-button-${uri.split('/').pop()}`}
        onClick={() => {
          setOpen(true);
          setStatus('idle');
          setError(null);
        }}
        className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Signaler cette vidéo"
        title="Signaler"
      >
        ⚑
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
            <h3 id="report-title" className="text-sm font-medium text-neutral-900">
              Signaler cette performance
            </h3>
            <p className="mt-1 text-xs text-neutral-500">{context}</p>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <textarea
                data-testid="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Raison (optionnel)"
                rows={3}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              {error ? (
                <p data-testid="report-error" className="text-xs text-red-600">
                  {error}
                </p>
              ) : null}
              {status === 'done' ? (
                <p data-testid="report-success" className="text-xs text-green-700">
                  Signalement envoyé.
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  data-testid="report-submit"
                  disabled={status === 'loading'}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {status === 'loading' ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

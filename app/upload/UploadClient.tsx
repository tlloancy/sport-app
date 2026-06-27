'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  errorOrigin,
  errorTypeLabel,
  formatErrorLocation,
  parseUploadErrorPayload,
  UploadFailure,
  type UploadErrorPayload,
} from '@/lib/upload-error';

const UNITS = ['kg', 's', 'm', 'reps'] as const;
const CHUNK_PROGRESS_MAX = 70;

const fieldClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-neutral-900';

type Phase = 'idle' | 'upload' | 'publish' | 'done';

type ChunkResponse = {
  videoHash: string;
  chunkManifest: string;
  error?: string;
  type?: string;
  step?: string;
  status?: number;
  details?: string;
};

type PerformanceResponse = ChunkResponse & {
  rkey?: string;
  did?: string;
};

function uploadChunk(
  formData: FormData,
  onFileProgress: (fileRatio: number) => void
): Promise<ChunkResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/chunk');
    xhr.responseType = 'text';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onFileProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      let raw: unknown;
      try {
        raw = JSON.parse(xhr.responseText);
      } catch {
        reject(
          new UploadFailure(
            parseUploadErrorPayload(null, 'chunk', xhr.status || 500)
          )
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(raw as ChunkResponse);
        return;
      }

      reject(
        new UploadFailure(parseUploadErrorPayload(raw, 'chunk', xhr.status))
      );
    };

    xhr.onerror = () => {
      reject(
        new UploadFailure(parseUploadErrorPayload(null, 'chunk', 0))
      );
    };

    xhr.onabort = () => {
      reject(
        new UploadFailure({
          error: 'Envoi de la vidéo annulé.',
          type: 'network',
          step: 'chunk',
          status: 0,
        })
      );
    };

    xhr.send(formData);
  });
}

function stepLabel(step: UploadErrorPayload['step']): string {
  return step === 'chunk' ? 'Envoi vidéo' : 'Publication ATProto';
}

export default function UploadClient() {
  const router = useRouter();
  const [movement, setMovement] = useState('snatch');
  const [value, setValue] = useState('35');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('kg');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<UploadErrorPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);

  function buttonLabel() {
    if (!busy) return 'Publier';
    if (phase === 'done') return 'Publié !';
    if (phase === 'publish') return 'Publication...';
    return `Upload ${uploadPct}%...`;
  }

  function fail(info: UploadErrorPayload) {
    setError(info);
    setBusy(false);
    setPhase('idle');
    setProgress(0);
    setUploadPct(0);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      fail({
        error: 'Sélectionne une vidéo avant de publier.',
        type: 'missing_file',
        step: 'chunk',
        status: 400,
      });
      return;
    }

    setBusy(true);
    setError(null);
    setPhase('upload');
    setProgress(0);
    setUploadPct(0);

    try {
      const chunkForm = new FormData();
      chunkForm.append('file', file);
      const chunkData = await uploadChunk(chunkForm, (fileRatio) => {
        const pct = Math.min(100, Math.round(fileRatio * 100));
        setUploadPct(pct);
        setProgress(Math.min(CHUNK_PROGRESS_MAX, Math.round(fileRatio * CHUNK_PROGRESS_MAX)));
      });
      setProgress(CHUNK_PROGRESS_MAX);
      setPhase('publish');

      const pubRes = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement,
          value: Number(value),
          unit,
          videoHash: chunkData.videoHash,
          chunkManifest: chunkData.chunkManifest,
        }),
      });

      let pubRaw: unknown;
      try {
        pubRaw = await pubRes.json();
      } catch {
        fail(parseUploadErrorPayload(null, 'publish', pubRes.status));
        return;
      }

      if (!pubRes.ok) {
        fail(parseUploadErrorPayload(pubRaw, 'publish', pubRes.status));
        return;
      }

      const pubData = pubRaw as PerformanceResponse;
      if (!pubData.rkey || !pubData.did) {
        fail({
          error: 'Réponse PDS incomplète (rkey ou did manquant).',
          type: 'invalid_response',
          step: 'publish',
          status: pubRes.status,
        });
        return;
      }

      setProgress(100);
      setPhase('done');

      router.push(
        `/performance/${pubData.rkey}?did=${encodeURIComponent(pubData.did)}`
      );
    } catch (err) {
      if (err instanceof UploadFailure) {
        fail(err.info);
        return;
      }
      const origin = errorOrigin(err);
      fail({
        error: err instanceof Error ? err.message : 'Échec inattendu de l’upload.',
        type: 'unknown',
        step: phase === 'publish' ? 'publish' : 'chunk',
        status: 500,
        file: origin.file,
        line: origin.line,
        stack: origin.stack,
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        data-testid="upload-file"
        type="file"
        accept="video/*"
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className={fieldClass}
      />

      <input
        data-testid="upload-movement"
        type="text"
        value={movement}
        onChange={(e) => setMovement(e.target.value)}
        placeholder="Mouvement"
        required
        disabled={busy}
        className={fieldClass}
      />

      <input
        data-testid="upload-value"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Valeur"
        required
        disabled={busy}
        className={fieldClass}
      />

      <select
        data-testid="upload-unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}
        disabled={busy}
        className={fieldClass}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>

      {busy ? (
        <div
          data-testid="upload-progress"
          className="flex items-center gap-3"
          aria-live="polite"
        >
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              data-testid="upload-progress-bar"
              className="h-full bg-neutral-900 transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span
            data-testid="upload-progress-text"
            className="w-10 text-right text-sm tabular-nums text-neutral-600"
          >
            {progress}%
          </span>
        </div>
      ) : null}

      {phase === 'publish' ? (
        <p className="text-sm text-neutral-500">Publication en cours...</p>
      ) : null}

      <button
        data-testid="upload-submit"
        type="submit"
        disabled={busy}
        className="mt-2 h-11 rounded-md bg-neutral-900 text-sm font-medium text-white disabled:bg-neutral-400 disabled:opacity-100"
      >
        {buttonLabel()}
      </button>

      {error ? (
        <div
          data-testid="upload-error"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-red-900" data-testid="upload-error-message">
            {error.error}
          </p>
          <p className="mt-2 text-xs text-red-800" data-testid="upload-error-meta">
            {errorTypeLabel(error.type)} · {stepLabel(error.step)} · HTTP {error.status}
          </p>
          {formatErrorLocation(error) ? (
            <p
              className="mt-1 font-mono text-xs text-red-800"
              data-testid="upload-error-location"
            >
              {formatErrorLocation(error)}
            </p>
          ) : null}
          {error.details ? (
            <pre
              data-testid="upload-error-details"
              className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-red-100/80 px-2 py-1.5 text-xs text-red-900"
            >
              {error.details}
            </pre>
          ) : null}
          {error.stack ? (
            <pre
              data-testid="upload-error-stack"
              className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-red-100/80 px-2 py-1.5 font-mono text-xs text-red-900"
            >
              {error.stack}
            </pre>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

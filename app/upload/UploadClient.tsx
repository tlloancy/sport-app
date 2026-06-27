'use client';

import UploadTraceLog from '@/components/UploadTraceLog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  errorOrigin,
  errorTypeLabel,
  formatErrorLocation,
  parseUploadErrorPayload,
  UploadFailure,
  type UploadErrorPayload,
} from '@/lib/upload-error';
import {
  createTraceEntry,
  formatBytes,
  PHASE_PROGRESS,
  UPLOAD_PHASE_LABEL,
  type TraceEntry,
  type TraceLevel,
  type UploadPhase,
} from '@/lib/upload-trace';
import {
  formatDurationSec,
  isWithinUploadLimits,
  probeClientVideoDuration,
  UPLOAD_LIMITS_MESSAGE,
  UPLOAD_RULES,
} from '@/lib/upload-limits';

const UNITS = ['kg', 's', 'm', 'reps'] as const;
const REDIRECT_DELAY_MS = 1000;

const fieldClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-neutral-900';

type PublishedPerformance = {
  did: string;
  rkey: string;
};

type ChunkResponse = {
  videoHash: string;
  chunkManifest: string;
  durationSec?: number;
};

type PerformanceResponse = ChunkResponse & {
  rkey?: string;
  did?: string;
};

type TraceFn = (tag: string, message: string, opts?: { detail?: string; level?: TraceLevel }) => void;

type UploadChunkHooks = {
  trace: TraceFn;
  onSendProgress: (ratio: number, loaded: number, total: number) => void;
  onSendComplete: (loaded: number) => void;
  onProcessingStart: () => void;
};

function uploadChunk(formData: FormData, hooks: UploadChunkHooks): Promise<ChunkResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoggedPct = -1;
    let processingStarted = false;
    let lastTotal = 0;

    hooks.trace('XHR', 'Ouverture POST /api/chunk');
    xhr.open('POST', '/api/chunk');
    xhr.responseType = 'text';

    xhr.upload.onloadstart = () => {
      hooks.trace('XHR', 'Transfert HTTP démarré');
    };

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      lastTotal = event.total;
      const ratio = event.loaded / event.total;
      hooks.onSendProgress(ratio, event.loaded, event.total);

      const pct = Math.floor(ratio * 100);
      if (pct >= lastLoggedPct + 10 || pct === 100) {
        lastLoggedPct = pct;
        hooks.trace('NET', `Envoi ${pct}%`, {
          detail: `${formatBytes(event.loaded)} / ${formatBytes(event.total)}`,
        });
      }
    };

    xhr.upload.onloadend = () => {
      hooks.onSendComplete(lastTotal);
      if (!processingStarted) {
        processingStarted = true;
        hooks.onProcessingStart();
        hooks.trace('FFMPEG', 'Fichier reçu par le serveur — découpage ffmpeg en cours', {
          detail: 'ffprobe + ffmpeg côté serveur (durée variable)',
          level: 'warn',
        });
      }
    };

    xhr.onload = () => {
      hooks.trace('XHR', `Réponse HTTP ${xhr.status}`, {
        detail: `${xhr.responseText.length} caractères`,
      });

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
        const data = raw as ChunkResponse;
        hooks.trace('OK', 'Chunking terminé', {
          detail: `videoHash=${data.videoHash.slice(0, 16)}… · durée=${data.durationSec ?? '?'}s`,
          level: 'ok',
        });
        resolve(data);
        return;
      }

      reject(
        new UploadFailure(parseUploadErrorPayload(raw, 'chunk', xhr.status))
      );
    };

    xhr.onerror = () => {
      hooks.trace('ERR', 'Erreur réseau XHR', { level: 'error' });
      reject(
        new UploadFailure(parseUploadErrorPayload(null, 'chunk', 0))
      );
    };

    xhr.onabort = () => {
      hooks.trace('ERR', 'Transfert annulé', { level: 'error' });
      reject(
        new UploadFailure({
          error: 'Envoi de la vidéo annulé.',
          type: 'network',
          step: 'chunk',
          status: 0,
        })
      );
    };

    hooks.trace('XHR', 'Envoi du FormData…');
    xhr.send(formData);
  });
}

function stepLabel(step: UploadErrorPayload['step']): string {
  return step === 'chunk' ? 'Envoi vidéo' : 'Publication ATProto';
}

function performanceHref({ did, rkey }: PublishedPerformance): string {
  return `/performance/${rkey}?did=${encodeURIComponent(did)}`;
}

function PhaseStatus({
  phase,
  showSpinner,
  label,
  testId,
}: {
  phase: UploadPhase;
  showSpinner: boolean;
  label: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 text-sm text-neutral-800"
      role="status"
    >
      {showSpinner ? (
        <span
          data-testid={`${testId}-spinner`}
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900"
          aria-hidden
        />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full bg-neutral-900" aria-hidden />
      )}
      <span>{label}</span>
      <span className="text-xs text-neutral-500">— {UPLOAD_PHASE_LABEL[phase]}</span>
    </div>
  );
}

export default function UploadClient() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traceRef = useRef<TraceEntry[]>([]);
  const [movement, setMovement] = useState('snatch');
  const [value, setValue] = useState('35');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('kg');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<UploadErrorPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<UploadPhase | 'idle'>('idle');
  const [progress, setProgress] = useState(0);
  const [sendPct, setSendPct] = useState(0);
  const [published, setPublished] = useState<PublishedPerformance | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [fileCheckStatus, setFileCheckStatus] = useState<
    'idle' | 'checking' | 'ok' | 'reject'
  >('idle');
  const [fileCheckMessage, setFileCheckMessage] = useState<string | null>(null);

  const inProgress = phase === 'send' || phase === 'ffmpeg' || phase === 'publish';

  const pushTrace = useCallback(
    (tag: string, message: string, opts?: { detail?: string; level?: TraceLevel }) => {
      const entry = createTraceEntry(tag, message, opts);
      traceRef.current = [...traceRef.current, entry];
      setTrace(traceRef.current);
      if (typeof console !== 'undefined') {
        const line = opts?.detail ? `${message} — ${opts.detail}` : message;
        console.log(`[upload:${tag}] ${line}`);
      }
    },
    []
  );

  useEffect(() => {
    if (!inProgress) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [inProgress]);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function analyzeFile(picked: File) {
    setFileCheckStatus('checking');
    setFileCheckMessage('Analyse des métadonnées vidéo…');
    setVideoDurationSec(null);

    try {
      const durationSec = await probeClientVideoDuration(picked);
      setVideoDurationSec(durationSec);
      const ok = isWithinUploadLimits(picked.size, durationSec);
      if (ok) {
        setFileCheckStatus('ok');
        setFileCheckMessage(
          `OK — ${formatBytes(picked.size)} · ${formatDurationSec(durationSec)}`
        );
        pushTrace('INIT', 'Fichier conforme', {
          detail: `${picked.name} · ${formatBytes(picked.size)} · ${formatDurationSec(durationSec)}`,
          level: 'ok',
        });
      } else {
        setFileCheckStatus('reject');
        setFileCheckMessage(UPLOAD_LIMITS_MESSAGE);
        pushTrace('ERR', UPLOAD_LIMITS_MESSAGE, {
          detail: `${formatBytes(picked.size)} · ${formatDurationSec(durationSec)}`,
          level: 'error',
        });
      }
    } catch (err) {
      setFileCheckStatus('reject');
      setFileCheckMessage(
        err instanceof Error ? err.message : 'Impossible de lire la vidéo'
      );
      pushTrace('ERR', 'Analyse vidéo impossible', {
        detail: err instanceof Error ? err.message : undefined,
        level: 'error',
      });
    }
  }

  function resetTrace() {
    traceRef.current = [];
    setTrace([]);
  }

  function resetFileCheck() {
    setVideoDurationSec(null);
    setFileCheckStatus('idle');
    setFileCheckMessage(null);
  }

  function buttonLabel() {
    if (phase === 'done') return 'Publié !';
    if (!busy) return 'Publier';
    if (phase === 'ffmpeg') return 'Traitement ffmpeg…';
    if (phase === 'publish') return 'Publication ATProto…';
    return `Envoi ${sendPct}%…`;
  }

  function fail(info: UploadErrorPayload) {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }
    pushTrace('ERR', info.error, {
      detail: `${errorTypeLabel(info.type)} · HTTP ${info.status}`,
      level: 'error',
    });
    setError(info);
    setBusy(false);
    setPhase('idle');
    setProgress(0);
    setSendPct(0);
    setPublished(null);
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

    if (fileCheckStatus === 'reject') {
      fail({
        error: fileCheckMessage ?? UPLOAD_LIMITS_MESSAGE,
        type: 'upload_limit',
        step: 'chunk',
        status: 413,
      });
      return;
    }

    if (fileCheckStatus === 'checking') {
      fail({
        error: 'Analyse vidéo en cours — patiente un instant.',
        type: 'chunk_processing',
        step: 'chunk',
        status: 400,
      });
      return;
    }

    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }

    resetTrace();
    setBusy(true);
    setError(null);
    setPublished(null);
    setPhase('send');
    setProgress(0);
    setSendPct(0);

    pushTrace('INIT', 'Session upload démarrée', {
      detail: `${file.name} · ${formatBytes(file.size)} · ${movement} ${value} ${unit}`,
    });
    pushTrace('SYS', 'Ne quitte pas cette page pendant la publication', { level: 'warn' });

    try {
      const chunkForm = new FormData();
      chunkForm.append('file', file);

      const chunkData = await uploadChunk(chunkForm, {
        trace: pushTrace,
        onSendProgress: (ratio) => {
          const pct = Math.min(100, Math.round(ratio * 100));
          setSendPct(pct);
          setProgress(Math.min(PHASE_PROGRESS.sendMax, Math.round(ratio * PHASE_PROGRESS.sendMax)));
        },
        onSendComplete: (loaded) => {
          setPhase('ffmpeg');
          setProgress(PHASE_PROGRESS.ffmpeg);
          pushTrace('NET', 'Transfert HTTP terminé', {
            detail: formatBytes(loaded),
            level: 'ok',
          });
        },
        onProcessingStart: () => {
          setPhase('ffmpeg');
          setProgress(PHASE_PROGRESS.ffmpeg);
        },
      });

      if (chunkData.durationSec != null) {
        setVideoDurationSec(chunkData.durationSec);
      }

      setPhase('publish');
      setProgress(PHASE_PROGRESS.publishStart);
      pushTrace('PDS', 'Publication ATProto — POST /api/performance', {
        detail: `videoHash=${chunkData.videoHash.slice(0, 16)}…`,
      });

      const pubBody = {
        movement,
        value: Number(value),
        unit,
        videoHash: chunkData.videoHash,
        chunkManifest: chunkData.chunkManifest,
      };
      pushTrace('PDS', 'Payload performance', {
        detail: JSON.stringify(pubBody),
        level: 'dim',
      });

      const pubRes = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pubBody),
      });

      pushTrace('PDS', `Réponse /api/performance — HTTP ${pubRes.status}`);

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

      const result = { did: pubData.did, rkey: pubData.rkey };
      setProgress(PHASE_PROGRESS.done);
      setPhase('done');
      setPublished(result);
      setBusy(false);

      pushTrace('OK', 'Performance publiée', {
        detail: `did=${result.did} rkey=${result.rkey}`,
        level: 'ok',
      });
      pushTrace('SYS', `Redirection dans ${REDIRECT_DELAY_MS / 1000}s`, { level: 'dim' });

      redirectTimer.current = setTimeout(() => {
        pushTrace('SYS', 'Redirection vers la fiche performance', { level: 'dim' });
        router.push(performanceHref(result));
      }, REDIRECT_DELAY_MS);
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

  const showProgressBar = busy || phase === 'done';
  const showPercent = phase === 'send';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        data-testid="upload-file"
        type="file"
        accept="video/*"
        disabled={busy}
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          setFile(picked);
          resetFileCheck();
          if (picked) {
            void analyzeFile(picked);
          }
        }}
        className={fieldClass}
      />

      <div
        data-testid="upload-rules"
        className="rounded-md border-2 border-neutral-900 bg-white px-4 py-3 text-sm text-neutral-900"
      >
        <p className="font-semibold tracking-tight">Conditions avant publication</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-800">
          {UPLOAD_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      {file && fileCheckMessage ? (
        <p
          data-testid="upload-file-check"
          className={`rounded-md border px-3 py-2 text-sm ${
            fileCheckStatus === 'ok'
              ? 'border-neutral-900 bg-neutral-50 text-neutral-900'
              : fileCheckStatus === 'reject'
                ? 'border-red-600 bg-red-50 text-red-900'
                : 'border-neutral-300 bg-neutral-50 text-neutral-700'
          }`}
          role="status"
        >
          {fileCheckMessage}
        </p>
      ) : null}

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

      {inProgress ? (
        <p
          data-testid="upload-stay-warning"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          Ne quitte pas cette page pendant la publication.
        </p>
      ) : null}

      {showProgressBar ? (
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
          {showPercent ? (
            <span
              data-testid="upload-progress-text"
              className="w-10 text-right text-sm tabular-nums text-neutral-600"
            >
              {progress}%
            </span>
          ) : (
            <span className="w-10 text-center text-neutral-400" aria-hidden>
              ···
            </span>
          )}
        </div>
      ) : null}

      {phase === 'send' && busy ? (
        <PhaseStatus
          phase="send"
          showSpinner={false}
          label="Envoi de la vidéo…"
          testId="upload-send-status"
        />
      ) : null}

      {phase === 'ffmpeg' ? (
        <PhaseStatus
          phase="ffmpeg"
          showSpinner
          label={
            videoDurationSec != null
              ? `Découpage en cours (vidéo de ${formatDurationSec(videoDurationSec)})…`
              : 'Découpage en cours…'
          }
          testId="upload-ffmpeg-status"
        />
      ) : null}

      {phase === 'publish' ? (
        <PhaseStatus
          phase="publish"
          showSpinner
          label="Publication sur ATProto…"
          testId="upload-publish-status"
        />
      ) : null}

      <UploadTraceLog entries={trace} active={inProgress} />

      {phase === 'done' && published ? (
        <div
          data-testid="upload-success"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900"
          role="status"
        >
          <p className="font-medium" data-testid="upload-success-message">
            Publié !
          </p>
          <Link
            data-testid="upload-success-link"
            href={performanceHref(published)}
            className="mt-2 inline-block underline"
          >
            Voir la performance
          </Link>
          <p className="mt-1 text-xs text-green-800">Redirection automatique dans 1 seconde…</p>
        </div>
      ) : null}

      <button
        data-testid="upload-submit"
        type="submit"
        disabled={busy || fileCheckStatus === 'reject' || fileCheckStatus === 'checking'}
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

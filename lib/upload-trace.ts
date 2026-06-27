export type TraceLevel = 'info' | 'ok' | 'warn' | 'error' | 'dim';

export type TraceEntry = {
  id: string;
  at: number;
  tag: string;
  message: string;
  detail?: string;
  level: TraceLevel;
};

let traceSeq = 0;

export function createTraceEntry(
  tag: string,
  message: string,
  opts?: { detail?: string; level?: TraceLevel; at?: number }
): TraceEntry {
  traceSeq += 1;
  return {
    id: `t-${traceSeq}-${Date.now()}`,
    at: opts?.at ?? Date.now(),
    tag,
    message,
    detail: opts?.detail,
    level: opts?.level ?? 'info',
  };
}

export function formatTraceTime(at: number): string {
  const d = new Date(at);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export const UPLOAD_PHASE_LABEL = {
  send: 'Envoi de la vidéo',
  ffmpeg: 'Traitement ffmpeg',
  publish: 'Publication ATProto',
  done: 'Terminé',
} as const;

export type UploadPhase = keyof typeof UPLOAD_PHASE_LABEL;

export const PHASE_PROGRESS = {
  sendMax: 60,
  ffmpeg: 72,
  publishStart: 85,
  done: 100,
} as const;

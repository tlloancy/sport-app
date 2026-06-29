export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Nominal limit shown to users (rules, error copy). */
export const MAX_UPLOAD_DURATION_SEC = 90;
/** Hidden slack for metadata/ffprobe drift (e.g. a 90s clip reported as 90.2s). */
export const UPLOAD_DURATION_GRACE_SEC = 5;

export const UPLOAD_LIMITS_MESSAGE =
  `Vidéo trop longue (max ${MAX_UPLOAD_DURATION_SEC}s) ou trop lourde (max 50 Mo)`;

export const UPLOAD_RULES = [
  `⏱ Max ${MAX_UPLOAD_DURATION_SEC} s`,
  '📦 Max 50 Mo',
  'Vidéo MP4, MOV, WebM…',
] as const;

export function maxAllowedUploadDurationSec(): number {
  return MAX_UPLOAD_DURATION_SEC + UPLOAD_DURATION_GRACE_SEC;
}

export function formatUploadBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '—';
  if (sizeBytes >= 1024 * 1024) {
    const mb = sizeBytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} Mo`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} Ko`;
}

export function isUploadTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_UPLOAD_BYTES;
}

export function isUploadTooLong(durationSec: number): boolean {
  return durationSec > maxAllowedUploadDurationSec();
}

export function isWithinUploadLimits(sizeBytes: number, durationSec: number): boolean {
  return !isUploadTooLarge(sizeBytes) && !isUploadTooLong(durationSec);
}

export function describeUploadLimitError(sizeBytes: number, durationSec: number): string {
  const tooLarge = isUploadTooLarge(sizeBytes);
  const tooLong = Number.isFinite(durationSec) && durationSec > 0 && isUploadTooLong(durationSec);
  const maxSize = formatUploadBytes(MAX_UPLOAD_BYTES);
  const sizeLabel = formatUploadBytes(sizeBytes);

  if (tooLarge && tooLong) {
    return `Vidéo trop lourde : ${sizeLabel} (max ${maxSize}). Vidéo trop longue : ${formatDurationSec(durationSec)} (max ${MAX_UPLOAD_DURATION_SEC} s).`;
  }
  if (tooLarge) {
    return `Vidéo trop lourde : ${sizeLabel} (max ${maxSize}).`;
  }
  if (tooLong) {
    return `Vidéo trop longue : ${formatDurationSec(durationSec)} (max ${MAX_UPLOAD_DURATION_SEC} s).`;
  }
  return UPLOAD_LIMITS_MESSAGE;
}

export function formatDurationSec(durationSec: number): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return '—';
  const rounded = Math.round(durationSec * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}s` : `${rounded.toFixed(1)}s`;
}

/** Read duration from a browser File without uploading (HTML5 metadata). */
export function probeClientVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Durée vidéo illisible'));
        return;
      }
      resolve(duration);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Impossible de lire les métadonnées vidéo'));
    };

    video.src = url;
  });
}

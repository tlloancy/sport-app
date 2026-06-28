export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_DURATION_SEC = 60;

export const UPLOAD_LIMITS_MESSAGE =
  'Vidéo trop longue (max 60s) ou trop lourde (max 50MB)';

export const UPLOAD_RULES = [
  '⏱ Max 60 s',
  '📦 Max 50 Mo',
  'Vidéo MP4, MOV, WebM…',
] as const;

export function isWithinUploadLimits(sizeBytes: number, durationSec: number): boolean {
  return sizeBytes <= MAX_UPLOAD_BYTES && durationSec <= MAX_UPLOAD_DURATION_SEC;
}

export function formatDurationSec(durationSec: number): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return '—';
  return `${Math.round(durationSec * 10) / 10}s`;
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

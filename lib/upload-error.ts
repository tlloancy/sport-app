import { UPLOAD_LIMITS_MESSAGE } from '@/lib/upload-limits';

export type UploadStep = 'chunk' | 'publish';

export type UploadErrorType =
  | 'missing_file'
  | 'invalid_body'
  | 'missing_fields'
  | 'ffmpeg'
  | 'chunk_processing'
  | 'disk'
  | 'pds_auth'
  | 'pds_publish'
  | 'network'
  | 'invalid_response'
  | 'upload_limit'
  | 'unknown';

export interface UploadErrorOrigin {
  file?: string;
  line?: number;
  stack?: string;
}

export interface UploadErrorPayload {
  error: string;
  type: UploadErrorType;
  step: UploadStep;
  status: number;
  details?: string;
  file?: string;
  line?: number;
  stack?: string;
}

export function uploadErrorBody(
  step: UploadStep,
  type: UploadErrorType,
  error: string,
  status: number,
  details?: string,
  origin?: UploadErrorOrigin
): UploadErrorPayload {
  return {
    error,
    type,
    step,
    status,
    details,
    file: origin?.file,
    line: origin?.line,
    stack: origin?.stack,
  };
}

export class UploadFailure extends Error {
  readonly info: UploadErrorPayload;

  constructor(info: UploadErrorPayload) {
    super(info.error);
    this.name = 'UploadFailure';
    this.info = info;
  }
}

/** First project frame from an Error stack (file, line, full stack text). */
export function errorOrigin(err: unknown): UploadErrorOrigin {
  if (!(err instanceof Error) || !err.stack) {
    return {};
  }

  const stack = err.stack;
  const frames = stack.split('\n').slice(1);

  for (const frame of frames) {
    const match = frame.match(/(?:\(|at\s+(?:async\s+)?(?:.*?\s)?(.+?):(\d+):(\d+)\)?)/);
    if (!match) continue;

    const filePath = match[1]!.replace(/\\/g, '/');
    if (
      filePath.includes('node_modules') ||
      filePath.startsWith('node:') ||
      filePath.includes('next/dist')
    ) {
      continue;
    }

    const file = shortenProjectPath(filePath);
    return {
      file,
      line: Number(match[2]),
      stack,
    };
  }

  return { stack };
}

function shortenProjectPath(filePath: string): string {
  const markers = ['sport-app/', '/app/', '/lib/', '/components/'];
  for (const marker of markers) {
    const idx = filePath.indexOf(marker);
    if (idx >= 0) {
      return filePath.slice(idx + (marker.startsWith('sport-app') ? marker.length : 1));
    }
  }
  const parts = filePath.split('/');
  return parts.length >= 2 ? parts.slice(-2).join('/') : filePath;
}

export function parseUploadErrorPayload(
  raw: unknown,
  step: UploadStep,
  status: number
): UploadErrorPayload {
  if (!raw || typeof raw !== 'object') {
    return {
      error: defaultMessage(step, status),
      type: status === 0 ? 'network' : 'invalid_response',
      step,
      status: status || 500,
      details:
        status >= 400
          ? 'Le serveur n’a pas renvoyé de JSON d’erreur structuré.'
          : undefined,
    };
  }

  const o = raw as Record<string, unknown>;
  const message =
    typeof o.error === 'string' && o.error.trim()
      ? o.error
      : defaultMessage(step, status);

  return {
    error: message,
    type: isUploadErrorType(o.type) ? o.type : inferType(step, status, message),
    step: o.step === 'chunk' || o.step === 'publish' ? o.step : step,
    status: typeof o.status === 'number' ? o.status : status,
    details: typeof o.details === 'string' ? o.details : undefined,
    file: typeof o.file === 'string' ? o.file : undefined,
    line: typeof o.line === 'number' ? o.line : undefined,
    stack: typeof o.stack === 'string' ? o.stack : undefined,
  };
}

function isUploadErrorType(value: unknown): value is UploadErrorType {
  return (
    value === 'missing_file' ||
    value === 'invalid_body' ||
    value === 'missing_fields' ||
    value === 'ffmpeg' ||
    value === 'chunk_processing' ||
    value === 'disk' ||
    value === 'pds_auth' ||
    value === 'pds_publish' ||
    value === 'network' ||
    value === 'invalid_response' ||
    value === 'upload_limit' ||
    value === 'unknown'
  );
}

function inferType(step: UploadStep, status: number, message?: string): UploadErrorType {
  if (status === 0 || status >= 502) return 'network';
  if (status === 413) return 'upload_limit';
  if (status === 400 && step === 'chunk') return 'missing_file';
  if (status === 400 && step === 'publish') return 'missing_fields';
  if (message?.toLowerCase().includes('ffmpeg')) return 'ffmpeg';
  if (step === 'publish' && (status === 401 || status === 403)) return 'pds_auth';
  if (step === 'publish') return 'pds_publish';
  return 'chunk_processing';
}

function defaultMessage(step: UploadStep, status: number): string {
  if (status === 0) {
    return step === 'chunk'
      ? 'Connexion interrompue pendant l’envoi de la vidéo.'
      : 'Connexion interrompue pendant la publication.';
  }
  if (status >= 502) {
    return 'Le serveur ne répond pas. Réessaie dans quelques instants.';
  }
  return step === 'chunk'
    ? 'Impossible de traiter la vidéo.'
    : 'Impossible de publier la performance sur le PDS.';
}

function withOrigin(
  body: UploadErrorPayload,
  err: unknown
): UploadErrorPayload {
  const origin = errorOrigin(err);
  return {
    ...body,
    file: origin.file ?? body.file,
    line: origin.line ?? body.line,
    stack: origin.stack ?? body.stack,
  };
}

export function classifyChunkError(err: unknown): UploadErrorPayload {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('trop longue') || lower.includes('too long') || lower.includes('50mb')) {
    return withOrigin(
      uploadErrorBody('chunk', 'upload_limit', UPLOAD_LIMITS_MESSAGE, 413, raw),
      err
    );
  }
  if (
    lower.includes('ffmpeg') ||
    lower.includes('invalid data found') ||
    lower.includes('no hls segments')
  ) {
    return withOrigin(
      uploadErrorBody(
        'chunk',
        'ffmpeg',
        'ffmpeg n’a pas pu lire ou découper cette vidéo.',
        422,
        raw.slice(0, 500)
      ),
      err
    );
  }
  if (lower.includes('enospc') || lower.includes('no space')) {
    return withOrigin(
      uploadErrorBody(
        'chunk',
        'disk',
        'Espace disque insuffisant pour enregistrer les chunks.',
        507,
        raw
      ),
      err
    );
  }
  if (lower.includes('eacces') || lower.includes('permission')) {
    return withOrigin(
      uploadErrorBody(
        'chunk',
        'disk',
        'Permission refusée lors de l’écriture des chunks.',
        500,
        raw
      ),
      err
    );
  }

  return withOrigin(
    uploadErrorBody(
      'chunk',
      'chunk_processing',
      'Erreur lors du découpage vidéo.',
      500,
      raw
    ),
    err
  );
}

export function classifyPublishError(err: unknown): UploadErrorPayload {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('login') || lower.includes('auth') || lower.includes('unauthorized')) {
    return withOrigin(
      uploadErrorBody(
        'publish',
        'pds_auth',
        'Connexion au PDS impossible (identifiants ou compte upload).',
        502,
        raw
      ),
      err
    );
  }
  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('network')
  ) {
    return withOrigin(
      uploadErrorBody(
        'publish',
        'network',
        'PDS injoignable. Vérifie que le serveur ATProto tourne.',
        502,
        raw
      ),
      err
    );
  }

  return withOrigin(
    uploadErrorBody(
      'publish',
      'pds_publish',
      'Le PDS a refusé la publication de la performance.',
      502,
      raw
    ),
    err
  );
}

export function errorTypeLabel(type: UploadErrorType): string {
  switch (type) {
    case 'missing_file':
      return 'Fichier manquant';
    case 'invalid_body':
      return 'Requête invalide';
    case 'missing_fields':
      return 'Champs manquants';
    case 'ffmpeg':
      return 'Vidéo illisible';
    case 'chunk_processing':
      return 'Découpage vidéo';
    case 'disk':
      return 'Stockage';
    case 'pds_auth':
      return 'Authentification PDS';
    case 'pds_publish':
      return 'Publication PDS';
    case 'network':
      return 'Réseau';
    case 'invalid_response':
      return 'Réponse serveur';
    case 'upload_limit':
      return 'Limites vidéo';
    default:
      return 'Erreur inconnue';
  }
}

export function formatErrorLocation(payload: UploadErrorPayload): string | null {
  if (!payload.file && payload.line == null) return null;
  if (payload.file && payload.line != null) return `${payload.file}:${payload.line}`;
  return payload.file ?? `ligne ${payload.line}`;
}

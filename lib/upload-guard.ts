import type { NextRequest } from 'next/server';
import { ANON_COOKIE, HOURLY_CHUNK_LIMIT } from '@/lib/anon';
import { countChunkUploadsSince } from '@/lib/db';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

/** Multipart overhead above raw file bytes. */
export const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + 2 * 1024 * 1024;

export function uploadClientKey(req: NextRequest): string {
  const anonId = req.cookies.get(ANON_COOKIE)?.value?.trim();
  if (anonId) return `anon:${anonId}`;

  const forwarded = req.headers.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown';
  return `ip:${ip}`;
}

export function readDeclaredBodyBytes(req: NextRequest): number | null {
  const raw = req.headers.get('content-length');
  if (!raw) return null;
  const size = Number.parseInt(raw, 10);
  if (!Number.isFinite(size) || size < 0) return null;
  return size;
}

export function isDeclaredBodyTooLarge(req: NextRequest): boolean {
  const size = readDeclaredBodyBytes(req);
  if (size == null) return false;
  return size > MAX_UPLOAD_BODY_BYTES;
}

export function isChunkUploadRateLimited(clientKey: string): boolean {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return countChunkUploadsSince(clientKey, since) >= HOURLY_CHUNK_LIMIT;
}

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'admin_session';
const TTL_MS = 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

export function adminPasswordConfigured(): boolean {
  return sessionSecret().length > 0;
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + TTL_MS;
  const payload = `admin:${exp}`;
  const sig = crypto
    .createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url');
  return `${exp}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token || !adminPasswordConfigured()) return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const payload = `admin:${exp}`;
  const expected = crypto
    .createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function setAdminSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL_MS / 1000,
    path: '/',
  });
}

export function clearAdminSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  return null;
}

export function isAdminRequest(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

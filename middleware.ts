import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ANON_COOKIE, ANON_MAX_AGE } from '@/lib/anon';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  if (!req.cookies.get(ANON_COOKIE)) {
    res.cookies.set(ANON_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ANON_MAX_AGE,
      path: '/',
    });
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

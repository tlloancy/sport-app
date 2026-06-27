import { NextRequest, NextResponse } from 'next/server';
import {
  adminPasswordConfigured,
  setAdminSessionCookie,
} from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD non configuré.' },
      { status: 503 }
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const password = body.password ?? '';
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminSessionCookie(res);
  return res;
}

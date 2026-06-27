import { NextRequest, NextResponse } from 'next/server';
import { ANON_COOKIE, HOURLY_REPORT_LIMIT } from '@/lib/anon';
import { countReportsSince, insertReport } from '@/lib/db';
import { sendReportEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const anonId = req.cookies.get(ANON_COOKIE)?.value;
  if (!anonId) {
    return NextResponse.json({ error: 'Identité anonyme manquante.' }, { status: 400 });
  }

  let body: { uri?: string; reason?: string; movement?: string };
  try {
    body = (await req.json()) as { uri?: string; reason?: string; movement?: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const uri = body.uri?.trim();
  if (!uri) {
    return NextResponse.json({ error: 'uri requis.' }, { status: 400 });
  }

  const reason = body.reason?.trim() || null;
  const movement = body.movement?.trim() || undefined;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (countReportsSince(anonId, since) >= HOURLY_REPORT_LIMIT) {
    return NextResponse.json(
      { error: 'Limite de signalements atteinte (5/h).' },
      { status: 429 }
    );
  }

  insertReport(uri, reason, anonId);

  try {
    await sendReportEmail({ uri, reason, movement });
  } catch (err) {
    console.error('[report] email failed', err);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deletePerformance, hidePerformance } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { uri?: string; action?: string };
  try {
    body = (await req.json()) as { uri?: string; action?: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const uri = body.uri?.trim();
  const action = body.action;

  if (!uri) {
    return NextResponse.json({ error: 'uri requis.' }, { status: 400 });
  }

  if (action === 'hide') {
    hidePerformance(uri);
    return NextResponse.json({ uri, hidden: true });
  }

  if (action === 'delete') {
    deletePerformance(uri);
    return NextResponse.json({ uri, deleted: true });
  }

  return NextResponse.json({ error: 'action invalide (hide | delete).' }, { status: 400 });
}

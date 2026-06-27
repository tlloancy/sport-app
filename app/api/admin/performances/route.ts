import { NextRequest, NextResponse } from 'next/server';
import { listPerformancesForAdmin } from '@/lib/admin-data';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const performances = await listPerformancesForAdmin();
    return NextResponse.json({ performances });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'load failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

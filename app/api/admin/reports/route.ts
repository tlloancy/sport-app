import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listRecentReports } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const reports = listRecentReports(50).map((r) => ({
    id: r.id,
    uri: r.uri,
    reason: r.reason,
    anonId: r.anon_id ? `${r.anon_id.slice(0, 8)}…` : null,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ reports });
}

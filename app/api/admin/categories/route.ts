import { NextRequest, NextResponse } from 'next/server';
import { listDisciplinesForAdmin } from '@/lib/admin-data';

export const runtime = 'nodejs';

/** @deprecated use /api/admin/disciplines */
export async function GET(req: NextRequest) {
  return NextResponse.json({ categories: listDisciplinesForAdmin() });
}

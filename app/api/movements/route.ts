import { NextRequest, NextResponse } from 'next/server';
import { listMovementsForDiscipline } from '@/lib/atproto';
import { isActiveDiscipline } from '@/lib/db';
import { pdsUrls } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const discipline = req.nextUrl.searchParams.get('discipline')?.trim().toLowerCase();
  if (!discipline || !isActiveDiscipline(discipline)) {
    return NextResponse.json({ movements: [] });
  }

  if (pdsUrls().length === 0) {
    return NextResponse.json({ movements: [] });
  }

  try {
    const movements = await listMovementsForDiscipline(discipline, pdsUrls());
    return NextResponse.json({ movements });
  } catch {
    return NextResponse.json({ movements: [] });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { listMovementsForDiscipline } from '@/lib/atproto';
import { isActiveDiscipline } from '@/lib/db';
import { movementSuggestionsForDiscipline } from '@/lib/discipline-suggestions';
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
    const fromFeed = await listMovementsForDiscipline(discipline, pdsUrls());
    const movements = movementSuggestionsForDiscipline(discipline, fromFeed);
    return NextResponse.json({ movements });
  } catch {
    return NextResponse.json({ movements: [] });
  }
}

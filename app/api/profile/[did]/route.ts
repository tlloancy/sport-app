import { NextRequest, NextResponse } from 'next/server';
import { loadProfile } from '@/lib/profile-server';
import { pdsUrls } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { did: string } }
) {
  const did = decodeURIComponent(params.did);

  if (!did.startsWith('did:')) {
    return NextResponse.json({ error: 'Invalid DID' }, { status: 400 });
  }

  if (pdsUrls().length === 0) {
    return NextResponse.json({ error: 'Aucune URL PDS configurée.' }, { status: 503 });
  }

  try {
    return NextResponse.json(await loadProfile(did));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile load failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

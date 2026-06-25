import { NextRequest, NextResponse } from 'next/server';
import { fetchChunkServer } from '@/lib/p2p-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get('hash');
  const peersParam = req.nextUrl.searchParams.get('peers') ?? '';
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'invalid hash' }, { status: 400 });
  }

  const peers = peersParam.split(',').filter(Boolean);
  try {
    const data = await fetchChunkServer(hash, peers);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch failed';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

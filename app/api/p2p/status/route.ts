import { NextResponse } from 'next/server';
import { getGatewayPeerId, p2pStatus } from '@/lib/p2p-gateway';

export const runtime = 'nodejs';

export async function GET() {
  const peerId = await getGatewayPeerId();
  const status = p2pStatus();
  return NextResponse.json({
    ...status,
    peerId: peerId ?? status.peerId,
    blobStoreDir: process.env.BLOB_STORE_DIR ?? '/var/lib/sport-p2p/blobs',
    coreP2pRoot: process.env.CORE_P2P_ROOT ?? '../core-p2p',
  });
}

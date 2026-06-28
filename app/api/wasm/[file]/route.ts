import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED: Record<string, string> = {
  'core_p2p.js': 'application/javascript; charset=utf-8',
  'core_p2p_bg.wasm': 'application/wasm',
  'core_p2p.d.ts': 'text/plain; charset=utf-8',
};

const WASM_DIRS = ['public/wasm', 'public/core-p2p'];

function resolveWasmPath(name: string): string | null {
  for (const dir of WASM_DIRS) {
    const filePath = path.join(process.cwd(), dir, name);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function wasmResponse(name: string, method: 'GET' | 'HEAD'): NextResponse {
  const contentType = ALLOWED[name];
  if (!contentType) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = resolveWasmPath(name);
  if (!filePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (method === 'HEAD') {
    const stat = fs.statSync(filePath);
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  const body = fs.readFileSync(filePath);
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { file: string } }
) {
  return wasmResponse(params.file, 'GET');
}

export async function HEAD(
  _req: NextRequest,
  { params }: { params: { file: string } }
) {
  return wasmResponse(params.file, 'HEAD');
}

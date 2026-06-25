import fs from 'fs';
import path from 'path';
import TestPerformanceClient from './TestPerformanceClient';

function loadManifest() {
  const file = path.join(process.cwd(), 'public/test-player/manifest.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as {
    hashes: string[];
    peers: string[];
  };
}

export default function TestPerformancePage() {
  const manifest = loadManifest();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">P2P test performance</h1>
      <TestPerformanceClient chunkManifest={manifest.hashes} peers={manifest.peers} />
    </main>
  );
}

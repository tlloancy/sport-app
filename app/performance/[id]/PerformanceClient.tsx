'use client';

import VideoDownloadButton from '@/components/VideoDownloadButton';
import VideoPlayer from '@/components/VideoPlayer';

function downloadFilename(movement: string, rkey: string): string {
  const base =
    movement
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'performance';
  return `${base}-${rkey.slice(0, 8)}.ts`;
}

export default function PerformanceClient({
  chunkManifest,
  peers,
  movement,
  rkey,
}: {
  chunkManifest: string[];
  peers: string[];
  movement: string;
  rkey: string;
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      <VideoPlayer chunkManifest={chunkManifest} peers={peers} />
      {chunkManifest.length > 0 ? (
        <VideoDownloadButton
          chunkManifest={chunkManifest}
          peers={peers}
          filename={downloadFilename(movement, rkey)}
        />
      ) : null}
    </div>
  );
}

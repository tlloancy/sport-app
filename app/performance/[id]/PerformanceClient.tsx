'use client';

import VideoPlayer from '@/components/VideoPlayer';

export default function PerformanceClient({
  chunkManifest,
  peers,
}: {
  chunkManifest: string[];
  peers: string[];
}) {
  return <VideoPlayer chunkManifest={chunkManifest} peers={peers} />;
}

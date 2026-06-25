'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export interface VideoPlayerProps {
  chunkManifest: string[];
  peers: string[];
}

const SEGMENT_URL = /^https:\/\/chunks\.local\/([a-f0-9]{64})\.ts(?:\?.*)?$/;

function buildPlaylist(hashes: string[]): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:3',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];
  for (const hash of hashes) {
    lines.push('#EXTINF:2.0,');
    lines.push(`https://chunks.local/${hash}.ts`);
  }
  lines.push('#EXT-X-ENDLIST');
  return lines.join('\n');
}

export default function VideoPlayer({ chunkManifest, peers }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || chunkManifest.length === 0) return undefined;

    let hls: Hls | null = null;
    let playlistUrl: string | null = null;
    const peerList = peers.join(',');

    if (!Hls.isSupported()) {
      setError('Hls.js is not supported in this browser');
      return undefined;
    }

    hls = new Hls({
      enableWorker: false,
      xhrSetup: (xhr, url) => {
        const match = url.match(SEGMENT_URL);
        if (match) {
          const qs = new URLSearchParams({ hash: match[1]!, peers: peerList });
          xhr.open('GET', `/api/p2p/chunk?${qs}`, true);
        }
      },
      fetchSetup: (context, initParams) => {
        const match = context.url.match(SEGMENT_URL);
        if (match) {
          const qs = new URLSearchParams({ hash: match[1]!, peers: peerList });
          return new Request(`/api/p2p/chunk?${qs}`, initParams);
        }
        return new Request(context.url, initParams);
      },
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        setError(`${data.type}: ${data.details}`);
      }
    });

    playlistUrl = URL.createObjectURL(
      new Blob([buildPlaylist(chunkManifest)], { type: 'application/vnd.apple.mpegurl' })
    );
    hls.loadSource(playlistUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => undefined);
    });

    return () => {
      hls?.destroy();
      if (playlistUrl) URL.revokeObjectURL(playlistUrl);
    };
  }, [chunkManifest, peers]);

  return (
    <div className="w-full max-w-xl">
      <video
        ref={videoRef}
        data-testid="video-player"
        controls
        playsInline
        muted
        autoPlay
        className="w-full rounded-lg bg-black"
      />
      {error ? (
        <p data-testid="player-error" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

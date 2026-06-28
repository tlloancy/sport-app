'use client';

import { ensureP2pWasm, fetchChunkViaWasm } from '@/lib/p2p-wasm-client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export interface VideoPlayerProps {
  chunkManifest: string[];
  peers: string[];
  autoPlay?: boolean;
  fill?: boolean;
  loop?: boolean;
  /** Play when entering viewport, pause when leaving. Uses rootMargin for early start. */
  viewportAutoplay?: boolean;
}

const SEGMENT_URL = /^https:\/\/chunks\.local\/([a-f0-9]{64})\.ts(?:\?.*)?$/;
const VIEWPORT_ROOT_MARGIN = '18% 0px';
const VIEWPORT_PLAY_RATIO = 0.22;

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

export default function VideoPlayer({
  chunkManifest,
  peers,
  autoPlay = true,
  fill = false,
  loop = false,
  viewportAutoplay = false,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldPlayRef = useRef(false);
  const wasmReadyRef = useRef(false);
  const blobUrlsRef = useRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const wantsPlayback = autoPlay || viewportAutoplay;

  useEffect(() => {
    if (!viewportAutoplay) return undefined;

    const root = containerRef.current;
    const video = videoRef.current;
    if (!root || !video) return undefined;

    const syncPlayback = (visible: boolean) => {
      shouldPlayRef.current = visible;
      if (!ready) return;
      if (visible) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const visible =
          entry.isIntersecting && entry.intersectionRatio >= VIEWPORT_PLAY_RATIO;
        syncPlayback(visible);
      },
      {
        root: null,
        rootMargin: VIEWPORT_ROOT_MARGIN,
        threshold: [0, 0.12, VIEWPORT_PLAY_RATIO, 0.45, 0.7],
      }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [viewportAutoplay, ready, chunkManifest]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || chunkManifest.length === 0) return undefined;

    let hls: Hls | null = null;
    let playlistUrl: string | null = null;
    let cancelled = false;
    const peerList = peers.join(',');

    setReady(false);
    setError(null);

    if (!Hls.isSupported()) {
      setError('Hls.js is not supported in this browser');
      return undefined;
    }

    const setup = async () => {
      wasmReadyRef.current = await ensureP2pWasm();
      if (cancelled) return;

      hls = new Hls({
        enableWorker: false,
        fetchSetup: async (context, initParams) => {
          const match = context.url.match(SEGMENT_URL);
          if (!match) {
            return new Request(context.url, initParams);
          }

          const hash = match[1]!;
          if (wasmReadyRef.current) {
            const buf = await fetchChunkViaWasm(hash, peers);
            if (buf) {
              const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'video/mp2t' }));
              blobUrlsRef.current.push(blobUrl);
              return new Request(blobUrl, initParams);
            }
          }

          const qs = new URLSearchParams({ hash, peers: peerList });
          return new Request(`/api/p2p/chunk?${qs}`, initParams);
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
        setReady(true);
        const playNow = autoPlay || (viewportAutoplay && shouldPlayRef.current);
        if (playNow) {
          video.play().catch(() => undefined);
        }
      });
    };

    void setup();

    return () => {
      cancelled = true;
      hls?.destroy();
      if (playlistUrl) URL.revokeObjectURL(playlistUrl);
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current = [];
      setReady(false);
    };
  }, [chunkManifest, peers, autoPlay, viewportAutoplay]);

  return (
    <div ref={containerRef} className={fill ? 'h-full w-full' : 'w-full'}>
      <video
        ref={videoRef}
        data-testid="video-player"
        controls
        playsInline
        muted
        loop={loop}
        preload={wantsPlayback ? 'auto' : 'metadata'}
        autoPlay={autoPlay && !viewportAutoplay}
        className={fill ? 'h-full w-full bg-neutral-900 object-contain' : 'w-full bg-neutral-900'}
      />
      {error ? (
        <p data-testid="player-error" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

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

const VIEWPORT_ROOT_MARGIN = '18% 0px';
const VIEWPORT_PLAY_RATIO = 0.22;

function chunkSegmentUrl(hash: string, peerList: string, origin: string): string {
  const qs = new URLSearchParams({ hash, peers: peerList });
  return `${origin}/api/p2p/chunk?${qs}`;
}

function buildPlaylist(hashes: string[], peerList: string, origin: string): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:3',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];
  for (const hash of hashes) {
    lines.push('#EXTINF:2.0,');
    lines.push(chunkSegmentUrl(hash, peerList, origin));
  }
  lines.push('#EXT-X-ENDLIST');
  return lines.join('\n');
}

function parseChunkApiUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname !== '/api/p2p/chunk') return null;
    const hash = parsed.searchParams.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
    return hash;
  } catch {
    return null;
  }
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
  const userUnmutedRef = useRef(false);
  const wasmReadyRef = useRef(false);
  const blobUrlsRef = useRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const wantsPlayback = autoPlay || viewportAutoplay;

  function applyAutoplayMute(video: HTMLVideoElement) {
    if (!userUnmutedRef.current) {
      video.muted = true;
    }
  }

  useEffect(() => {
    userUnmutedRef.current = false;
  }, [chunkManifest]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && wantsPlayback) {
      applyAutoplayMute(video);
    }
  }, [wantsPlayback, chunkManifest]);

  useEffect(() => {
    if (!viewportAutoplay) return undefined;

    const root = containerRef.current;
    const video = videoRef.current;
    if (!root || !video) return undefined;

    const syncPlayback = (visible: boolean) => {
      shouldPlayRef.current = visible;
      if (!ready) return;
      if (visible) {
        applyAutoplayMute(video);
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
    wasmReadyRef.current = false;

    if (!Hls.isSupported()) {
      setError('Hls.js is not supported in this browser');
      return undefined;
    }

    void ensureP2pWasm().then((ok) => {
      if (!cancelled) wasmReadyRef.current = ok;
    });

    hls = new Hls({
      enableWorker: false,
      fetchSetup: async (context, initParams) => {
        const hash = parseChunkApiUrl(context.url);
        if (hash && wasmReadyRef.current) {
          const buf = await fetchChunkViaWasm(hash, peers);
          if (buf) {
            const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'video/mp2t' }));
            blobUrlsRef.current.push(blobUrl);
            return new Request(blobUrl, initParams);
          }
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
      new Blob([buildPlaylist(chunkManifest, peerList, window.location.origin)], {
        type: 'application/vnd.apple.mpegurl',
      })
    );
    hls.loadSource(playlistUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (cancelled) return;
      setReady(true);
      const playNow = autoPlay || (viewportAutoplay && shouldPlayRef.current);
      if (playNow) {
        applyAutoplayMute(video);
        video.play().catch(() => undefined);
      }
    });

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
        loop={loop}
        preload={wantsPlayback ? 'auto' : 'metadata'}
        autoPlay={autoPlay && !viewportAutoplay}
        onVolumeChange={(event) => {
          const video = event.currentTarget;
          if (!video.muted && video.volume > 0) {
            userUnmutedRef.current = true;
          }
        }}
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

'use client';

import { useState } from 'react';

type VideoDownloadButtonProps = {
  chunkManifest: string[];
  peers: string[];
  filename: string;
};

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function VideoDownloadButton({
  chunkManifest,
  peers,
  filename,
}: VideoDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    if (busy || chunkManifest.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const peerList = peers.join(',');
      const parts: BlobPart[] = [];

      for (const hash of chunkManifest) {
        const qs = new URLSearchParams({ hash, peers: peerList });
        const res = await fetch(`/api/p2p/chunk?${qs}`);
        if (!res.ok) {
          throw new Error(`Segment indisponible (${res.status})`);
        }
        parts.push(await res.arrayBuffer());
      }

      const blob = new Blob(parts, { type: 'video/mp2t' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        data-testid="video-download-button"
        onClick={() => void onDownload()}
        disabled={busy}
        className="rounded-full border border-neutral-300 bg-white p-2.5 text-neutral-700 shadow-sm transition-colors hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50"
        aria-label="Télécharger la vidéo"
        title="Télécharger"
      >
        <DownloadIcon />
      </button>
      {busy ? (
        <p className="text-xs text-neutral-500" role="status">
          Préparation…
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

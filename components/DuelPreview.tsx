'use client';

import VideoPlayer from '@/components/VideoPlayer';
import type { DuelPair } from '@/lib/duel-pair';

export default function DuelPreview({ pair, label }: { pair: DuelPair; label: string }) {
  const cards = [
    { side: 'a' as const, entry: pair.a },
    { side: 'b' as const, entry: pair.b },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col">
      <header className="border-b border-neutral-200 px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">Duel</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {label} · Tranche {pair.tranche}
        </h1>
      </header>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
        {cards.map(({ side, entry }) => (
          <article
            key={entry.uri}
            data-testid={`duel-${side}`}
            className="flex flex-col border-neutral-200 md:border-r md:last:border-r-0"
          >
            <div className="relative min-h-[40dvh] flex-1 bg-neutral-950 md:min-h-0">
              {entry.hashes.length > 0 ? (
                <VideoPlayer
                  chunkManifest={entry.hashes}
                  peers={[entry.peerId]}
                  fill
                  autoPlay
                  viewportAutoplay
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                  Vidéo indisponible
                </div>
              )}
            </div>
            <div className="border-t border-neutral-100 px-4 py-3">
              <p className="text-sm font-medium text-neutral-900">
                {entry.record.value} {entry.record.unit}
              </p>
              <button
                type="button"
                disabled
                className="mt-3 w-full rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-400"
                data-testid={`duel-choose-${side}`}
              >
                Choisir
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

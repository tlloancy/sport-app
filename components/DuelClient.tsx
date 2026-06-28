'use client';

import VideoPlayer from '@/components/VideoPlayer';
import type { DuelPair } from '@/lib/duel-pair';
import { formatMetricValue, type MetricType } from '@/lib/metrics';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type DuelResponse = { pair: DuelPair | null; error?: string };

export default function DuelClient({ slug, label }: { slug: string; label: string }) {
  const [pair, setPair] = useState<DuelPair | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [chosen, setChosen] = useState<'a' | 'b' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPair = useCallback(async () => {
    setLoading(true);
    setError(null);
    setChosen(null);
    try {
      const res = await fetch(`/api/${encodeURIComponent(slug)}/duel`);
      const data = (await res.json()) as DuelResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setPair(data.pair);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
      setPair(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadPair();
  }, [loadPair]);

  const vote = async (side: 'a' | 'b') => {
    if (!pair || voting) return;
    setVoting(true);
    setChosen(side);

    const winner = side === 'a' ? pair.a.uri : pair.b.uri;
    const loser = side === 'a' ? pair.b.uri : pair.a.uri;

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner, loser }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote impossible');
      setChosen(null);
      setVoting(false);
      return;
    }

    window.setTimeout(() => {
      setVoting(false);
      void loadPair();
    }, 300);
  };

  if (loading && !pair) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-neutral-500">
        Chargement du duel…
      </div>
    );
  }

  if (!pair) {
    return (
      <div
        data-testid="duel-empty"
        className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center"
      >
        <p className="text-neutral-600">
          {error ?? 'Pas assez de performances pour le même mouvement.'}
        </p>
        <Link href={`/${slug}`} className="mt-4 text-sm text-neutral-500 underline">
          Retour au feed {label}
        </Link>
      </div>
    );
  }

  const cards = [
    { side: 'a' as const, entry: pair.a },
    { side: 'b' as const, entry: pair.b },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col">
      <header className="border-b border-neutral-200 px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">Duel</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {label} · {pair.movement}
        </h1>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </header>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
        {cards.map(({ side, entry }) => {
          const isWinner = chosen === side;
          const isLoser = chosen !== null && chosen !== side;
          const metricDisplay = formatMetricValue(
            entry.record.metricType as MetricType,
            entry.record.value,
            entry.record.unit
          );
          return (
            <article
              key={entry.uri}
              data-testid={`duel-${side}`}
              className={`flex flex-col border-neutral-200 transition-all duration-300 md:border-r md:last:border-r-0 ${
                isWinner ? 'ring-2 ring-inset ring-green-500 scale-[1.01]' : ''
              } ${isLoser ? 'opacity-40 scale-[0.98]' : ''}`}
            >
              <div className="relative min-h-[40dvh] flex-1 bg-neutral-950 md:min-h-0">
                {entry.hashes.length > 0 ? (
                  <VideoPlayer
                    chunkManifest={entry.hashes}
                    peers={[entry.peerId]}
                    fill
                    autoPlay
                    loop
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
                  {metricDisplay !== '—' ? metricDisplay : entry.record.movement}
                </p>
                <button
                  type="button"
                  disabled={voting}
                  onClick={() => void vote(side)}
                  aria-label="Donner de la force"
                  className="mt-3 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-neutral-400"
                  data-testid={`duel-choose-${side}`}
                >
                  💪 Force
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

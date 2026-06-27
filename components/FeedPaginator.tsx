'use client';

import FeedItemCard from '@/components/FeedItemCard';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedPagePayload } from '@/lib/feed-pagination';

type FeedPaginatorProps = {
  movement: string;
  initial: FeedPagePayload;
};

function PageIndicator({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <div
      className="flex items-center justify-center gap-4 py-5 font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-400"
      aria-live="polite"
    >
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-neutral-200" aria-hidden />
      <span data-testid="feed-page-indicator" className="text-neutral-600">
        <span className="text-neutral-900">{String(page).padStart(2, '0')}</span>
        <span className="mx-2 text-neutral-300">/</span>
        <span>{String(totalPages).padStart(2, '0')}</span>
      </span>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-neutral-200" aria-hidden />
    </div>
  );
}

export default function FeedPaginator({ movement, initial }: FeedPaginatorProps) {
  const [data, setData] = useState<FeedPagePayload>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const lastScrollY = useRef(0);
  const scrollDir = useRef<'up' | 'down'>('down');

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      scrollDir.current = y > lastScrollY.current ? 'down' : 'up';
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (lockRef.current || nextPage < 1 || nextPage > data.totalPages || nextPage === data.page) {
        return;
      }
      lockRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/feed?movement=${encodeURIComponent(movement)}&page=${nextPage}`
        );
        const json = (await res.json()) as FeedPagePayload & { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }

        setData(json);
        window.history.replaceState(null, '', `/feed?movement=${movement}&page=${nextPage}`);

        requestAnimationFrame(() => {
          if (gridRef.current) {
            const top = gridRef.current.getBoundingClientRect().top + window.scrollY - 24;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chargement impossible');
      } finally {
        setLoading(false);
        window.setTimeout(() => {
          lockRef.current = false;
        }, 600);
      }
    },
    [data.page, data.totalPages, movement]
  );

  useEffect(() => {
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!topEl || !bottomEl) return;

    const topObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || scrollDir.current !== 'up') return;
        if (data.page <= 1) return;
        void loadPage(data.page - 1);
      },
      { root: null, rootMargin: '0px', threshold: 0 }
    );

    const bottomObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || scrollDir.current !== 'down') return;
        if (data.page >= data.totalPages) return;
        void loadPage(data.page + 1);
      },
      { root: null, rootMargin: '120px', threshold: 0 }
    );

    topObserver.observe(topEl);
    bottomObserver.observe(bottomEl);

    return () => {
      topObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, [data.page, data.totalPages, loadPage]);

  const empty = data.total === 0;

  return (
    <>
      <header className="mb-2 flex items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">
            Performances
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Feed</h1>
        </div>
        <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
          Accueil
        </Link>
      </header>

      {!empty ? <PageIndicator page={data.page} totalPages={data.totalPages} /> : null}

      {error ? (
        <p data-testid="feed-error" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div ref={topSentinelRef} className="h-px w-full" aria-hidden data-testid="feed-sentinel-top" />

      {empty ? (
        <p data-testid="feed-empty" className="py-16 text-center text-neutral-500">
          Aucune performance pour l&apos;instant.
        </p>
      ) : (
        <div
          ref={gridRef}
          data-testid="feed-grid"
          className={`grid grid-cols-1 gap-5 transition-opacity duration-300 sm:grid-cols-2 ${
            loading ? 'opacity-40' : 'opacity-100'
          }`}
        >
          {data.items.map((item) => (
            <FeedItemCard key={item.uri} item={item} />
          ))}
        </div>
      )}

      <div
        ref={bottomSentinelRef}
        className="h-px w-full"
        aria-hidden
        data-testid="feed-sentinel-bottom"
      />

      {!empty ? <PageIndicator page={data.page} totalPages={data.totalPages} /> : null}

      {!empty && (data.page < data.totalPages || data.page > 1) ? (
        <p className="pb-10 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
          {data.page > 1 && data.page < data.totalPages
            ? 'Scroll · navigation par page'
            : data.page < data.totalPages
              ? 'Scroll ↓ · page suivante'
              : 'Scroll ↑ · page précédente'}
        </p>
      ) : null}
    </>
  );
}

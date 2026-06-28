'use client';

import FeedItemCard from '@/components/FeedItemCard';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedPagePayload } from '@/lib/feed-pagination';

type FeedPaginatorProps = {
  slug: string;
  label: string;
  initial: FeedPagePayload;
};

const SCROLL_EDGE = 12;

function PageIndicator({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <div
      className="pointer-events-none flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500"
      aria-live="polite"
    >
      <span className="h-px w-8 bg-neutral-300/80" aria-hidden />
      <span data-testid="feed-page-indicator">
        <span className="text-neutral-900">{String(page).padStart(2, '0')}</span>
        <span className="mx-2 text-neutral-400">/</span>
        <span>{String(totalPages).padStart(2, '0')}</span>
      </span>
      <span className="h-px w-8 bg-neutral-300/80" aria-hidden />
    </div>
  );
}

export default function FeedPaginator({ slug, label, initial }: FeedPaginatorProps) {
  const [data, setData] = useState<FeedPagePayload>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const touchStartY = useRef(0);
  const lastScrollY = useRef(0);
  const scrollDir = useRef<'up' | 'down'>('down');

  const atScrollTop = () => window.scrollY <= SCROLL_EDGE;

  const loadPage = useCallback(
    async (nextPage: number, direction: 'up' | 'down') => {
      if (lockRef.current || nextPage < 1 || nextPage > data.totalPages || nextPage === data.page) {
        return;
      }
      lockRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/feed?discipline=${encodeURIComponent(slug)}&page=${nextPage}`
        );
        const json = (await res.json()) as FeedPagePayload & { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }

        setData(json);
        window.history.replaceState(null, '', `/${slug}${nextPage > 1 ? `?page=${nextPage}` : ''}`);

        requestAnimationFrame(() => {
          if (direction === 'up') {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo({ top: Math.max(0, max), behavior: 'auto' });
          } else if (gridRef.current) {
            const top = gridRef.current.getBoundingClientRect().top + window.scrollY - 24;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chargement impossible');
      } finally {
        setLoading(false);
        window.setTimeout(() => {
          lockRef.current = false;
        }, 700);
      }
    },
    [data.page, data.totalPages, slug]
  );

  const tryPageUp = useCallback(() => {
    if (data.page > 1) void loadPage(data.page - 1, 'up');
  }, [data.page, loadPage]);

  useEffect(() => {
    document.documentElement.style.scrollSnapType = 'y proximity';
    return () => {
      document.documentElement.style.scrollSnapType = '';
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      scrollDir.current = y > lastScrollY.current ? 'down' : 'up';
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (lockRef.current || loading) return;

      if (atScrollTop() && e.deltaY < 0) {
        if (data.page <= 1) return;
        e.preventDefault();
        tryPageUp();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (lockRef.current || loading) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
      const delta = endY - touchStartY.current;

      if (atScrollTop() && delta > 48 && data.page > 1) {
        tryPageUp();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [data.page, loading, tryPageUp]);

  useEffect(() => {
    const bottomEl = bottomSentinelRef.current;
    if (!bottomEl) return;

    const bottomObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || scrollDir.current !== 'down') return;
        if (data.page >= data.totalPages) return;
        void loadPage(data.page + 1, 'down');
      },
      { root: null, rootMargin: '120px', threshold: 0 }
    );

    bottomObserver.observe(bottomEl);

    return () => {
      bottomObserver.disconnect();
    };
  }, [data.page, data.totalPages, loadPage]);

  const empty = data.total === 0;

  return (
    <div className="relative">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-end justify-between gap-4 bg-gradient-to-b from-white/90 via-white/70 to-transparent px-6 pb-4 pt-5">
        <div className="pointer-events-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">
            Performances
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{label}</h1>
        </div>
        <div className="pointer-events-auto flex items-center gap-4">
          <Link
            href={`/${slug}/duel`}
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Duel
          </Link>
          <Link
            href="/"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            aria-label="Accueil"
          >
            ←
          </Link>
        </div>
      </header>

      {!empty ? (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border border-neutral-200/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm">
          <PageIndicator page={data.page} totalPages={data.totalPages} />
        </div>
      ) : null}

      {error ? (
        <p
          data-testid="feed-error"
          className="fixed left-1/2 top-24 z-30 -translate-x-1/2 text-sm text-red-600"
        >
          {error}
        </p>
      ) : null}

      {empty ? (
        <div
          data-testid="feed-empty"
          className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-neutral-500"
        >
          <p>Sois le premier.</p>
          <Link href="/upload" className="text-sm text-neutral-900 underline underline-offset-2">
            + Perf
          </Link>
        </div>
      ) : (
        <div
          ref={gridRef}
          data-testid="feed-grid"
          className={`mx-auto grid max-w-6xl grid-cols-1 snap-y snap-proximity sm:grid-cols-2 ${
            loading ? 'opacity-50 transition-opacity duration-300' : 'opacity-100'
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

      {!empty && (data.page < data.totalPages || data.page > 1) ? (
        <p className="pointer-events-none fixed bottom-16 left-1/2 z-20 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
          {data.page > 1 && data.page < data.totalPages
            ? 'Scroll · navigation par page'
            : data.page < data.totalPages
              ? 'Scroll ↓ · page suivante'
              : 'Scroll ↑ · page précédente'}
        </p>
      ) : null}
    </div>
  );
}

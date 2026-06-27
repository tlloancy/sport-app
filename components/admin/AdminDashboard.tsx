'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type Report = {
  id: number;
  uri: string;
  reason: string | null;
  anonId: string | null;
  createdAt: string;
};

type Performance = {
  uri: string;
  rkey: string;
  movement: string;
  value: number;
  unit: string;
  tranche?: string;
  createdAt: string;
  hidden: boolean;
  deleted: boolean;
};

type Category = {
  slug: string;
  label: string;
  active: boolean;
};

type AdminDashboardProps = {
  initialReports: Report[];
  initialPerformances: Performance[];
  initialCategories: Category[];
};

export default function AdminDashboard({
  initialReports,
  initialPerformances,
  initialCategories,
}: AdminDashboardProps) {
  const router = useRouter();
  const [reports] = useState(initialReports);
  const [performances, setPerformances] = useState(initialPerformances);
  const [categories, setCategories] = useState(initialCategories);
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function moderate(uri: string, action: 'hide' | 'delete') {
    setMessage(null);
    const res = await fetch('/api/admin/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, action }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(json.error ?? 'Action impossible');
      return;
    }
    setPerformances((prev) =>
      prev.map((p) =>
        p.uri === uri
          ? { ...p, hidden: action === 'hide' ? true : p.hidden, deleted: action === 'delete' ? true : p.deleted }
          : p
      )
    );
    router.refresh();
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, label }),
    });
    const json = (await res.json()) as Category & { error?: string };
    if (!res.ok) {
      setMessage(json.error ?? 'Ajout impossible');
      return;
    }
    setCategories((prev) => [...prev, { slug: json.slug, label: json.label, active: true }]);
    setSlug('');
    setLabel('');
    router.refresh();
  }

  async function removeCategory(categorySlug: string) {
    setMessage(null);
    const res = await fetch(`/api/admin/categories/${encodeURIComponent(categorySlug)}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(json.error ?? 'Suppression impossible');
      return;
    }
    setCategories((prev) => prev.filter((c) => c.slug !== categorySlug));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header className="flex items-end justify-between border-b border-neutral-200 pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">Admin</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <a href="/feed" className="text-sm text-neutral-500 hover:text-neutral-900">
          Feed
        </a>
      </header>

      {message ? (
        <p data-testid="admin-message" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Signalements récents
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucun signalement.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {reports.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <p className="font-mono text-xs text-neutral-400">{r.uri}</p>
                <p className="mt-1">{r.reason ?? '—'}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {r.anonId ?? 'anon'} · {new Date(r.createdAt).toLocaleString('fr-FR')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Performances
        </h2>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {performances.map((p) => (
            <li key={p.uri} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {p.movement} · {p.value} {p.unit}
                </p>
                <p className="font-mono text-xs text-neutral-400">{p.uri}</p>
                {(p.hidden || p.deleted) && (
                  <p className="mt-1 text-xs text-amber-700">
                    {p.hidden ? 'masquée' : ''}
                    {p.hidden && p.deleted ? ' · ' : ''}
                    {p.deleted ? 'supprimée' : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid={`admin-hide-${p.rkey}`}
                  onClick={() => void moderate(p.uri, 'hide')}
                  className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50"
                >
                  Masquer
                </button>
                <button
                  type="button"
                  data-testid={`admin-delete-${p.rkey}`}
                  onClick={() => void moderate(p.uri, 'delete')}
                  className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">
          Catégories
        </h2>
        <form onSubmit={addCategory} className="mb-4 flex flex-wrap gap-3">
          <input
            data-testid="admin-category-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (clean-jerk)"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            required
          />
          <input
            data-testid="admin-category-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (Clean & Jerk)"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            data-testid="admin-category-add"
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Ajouter
          </button>
        </form>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {categories.map((c) => (
            <li key={c.slug} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="ml-2 font-mono text-xs text-neutral-400">{c.slug}</span>
                {!c.active ? (
                  <span className="ml-2 text-xs text-neutral-400">(inactive)</span>
                ) : null}
              </span>
              {c.active ? (
                <button
                  type="button"
                  data-testid={`admin-category-delete-${c.slug}`}
                  onClick={() => void removeCategory(c.slug)}
                  className="text-xs text-red-700 hover:underline"
                >
                  Désactiver
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

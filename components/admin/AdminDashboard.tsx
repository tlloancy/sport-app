'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { METRIC_LABELS, METRIC_TYPES, type MetricType } from '@/lib/metrics';

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
  family: string;
  discipline: string;
  movement: string;
  metricType: string;
  displayValue: string;
  createdAt: string;
  hidden: boolean;
  deleted: boolean;
};

type Discipline = {
  slug: string;
  label: string;
  family: string;
  metricType: MetricType;
  active: boolean;
};

type AdminDashboardProps = {
  initialReports: Report[];
  initialPerformances: Performance[];
  initialDisciplines: Discipline[];
  initialFamilies: Array<{ slug: string; label: string }>;
};

export default function AdminDashboard({
  initialReports,
  initialPerformances,
  initialDisciplines,
  initialFamilies,
}: AdminDashboardProps) {
  const router = useRouter();
  const [reports] = useState(initialReports);
  const [performances, setPerformances] = useState(initialPerformances);
  const [disciplines, setDisciplines] = useState(initialDisciplines);
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [family, setFamily] = useState(initialFamilies[0]?.slug ?? 'sport');
  const [metricType, setMetricType] = useState<MetricType>('weight');
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

  async function addDiscipline(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch('/api/admin/disciplines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, label, family, metricType }),
    });
    const json = (await res.json()) as Discipline & { error?: string };
    if (!res.ok) {
      setMessage(json.error ?? 'Ajout impossible');
      return;
    }
    setDisciplines((prev) => [
      ...prev,
      { slug: json.slug, label: json.label, family: json.family, metricType: json.metricType, active: true },
    ]);
    setSlug('');
    setLabel('');
    router.refresh();
  }

  async function removeDiscipline(disciplineSlug: string) {
    setMessage(null);
    const res = await fetch(`/api/admin/disciplines/${encodeURIComponent(disciplineSlug)}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(json.error ?? 'Suppression impossible');
      return;
    }
    setDisciplines((prev) => prev.filter((d) => d.slug !== disciplineSlug));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header className="flex items-end justify-between border-b border-neutral-200 pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">Admin</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <a href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          Accueil
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
                  {p.discipline} · {p.movement} · {p.displayValue}
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
          Disciplines
        </h2>
        <form onSubmit={addDiscipline} className="mb-4 flex flex-wrap gap-3">
          <input
            data-testid="admin-discipline-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (crossfit)"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            required
          />
          <input
            data-testid="admin-discipline-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (Crossfit)"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            required
          />
          <select
            data-testid="admin-discipline-family"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {initialFamilies.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            data-testid="admin-discipline-metric"
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as MetricType)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {METRIC_TYPES.map((type) => (
              <option key={type} value={type}>
                {METRIC_LABELS[type]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            data-testid="admin-discipline-add"
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Ajouter
          </button>
        </form>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {disciplines.map((d) => (
            <li key={d.slug} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{d.label}</span>
                <span className="ml-2 font-mono text-xs text-neutral-400">{d.slug}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {d.family} · {METRIC_LABELS[d.metricType]}
                </span>
                {!d.active ? (
                  <span className="ml-2 text-xs text-neutral-400">(inactive)</span>
                ) : null}
              </span>
              {d.active ? (
                <button
                  type="button"
                  data-testid={`admin-discipline-delete-${d.slug}`}
                  onClick={() => void removeDiscipline(d.slug)}
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

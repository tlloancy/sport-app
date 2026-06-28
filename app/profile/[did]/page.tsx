import { formatMetricValue, type MetricType } from '@/lib/metrics';
import { loadProfile } from '@/lib/profile-server';
import { pdsUrls } from '@/lib/upload-agent';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { did: string };
};

export default async function ProfilePage({ params }: PageProps) {
  const did = decodeURIComponent(params.did);

  if (!did.startsWith('did:')) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-red-600">DID invalide.</p>
      </main>
    );
  }

  if (pdsUrls().length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-red-600">Aucune URL PDS configurée.</p>
      </main>
    );
  }

  const profile = await loadProfile(did);

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 px-6 py-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          Accueil
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight" data-testid="profile-handle">
          {profile.handle}
        </h1>
        <p className="mt-1 font-mono text-xs text-neutral-400">{did}</p>
      </header>

      {profile.disciplines.length === 0 ? (
        <p className="px-6 py-10 text-neutral-500">Aucune performance publiée.</p>
      ) : (
        <div className="mx-auto max-w-3xl space-y-10 px-6 py-8">
          {profile.disciplines.map((discipline) => (
            <section key={discipline.slug} data-testid={`profile-discipline-${discipline.slug}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{discipline.label}</h2>
                <p className="text-sm text-neutral-600">
                  ELO{' '}
                  <span className="font-medium tabular-nums text-neutral-900">
                    {discipline.eloScore}
                  </span>
                </p>
              </div>

              {discipline.ranks.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {discipline.ranks.map((rank) => (
                    <li
                      key={rank.movement}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
                    >
                      {rank.label}
                    </li>
                  ))}
                </ul>
              ) : null}

              <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {discipline.performances.map((perf) => (
                  <li key={perf.uri} className="px-4 py-3">
                    <Link
                      href={`/performance/${perf.rkey}?did=${encodeURIComponent(did)}`}
                      className="flex items-center justify-between gap-4 hover:text-neutral-600"
                    >
                      <span className="text-sm font-medium">
                        {perf.record.movement}
                        <span className="ml-2 text-neutral-400">
                          {formatMetricValue(
                            perf.record.metricType as MetricType,
                            perf.record.value,
                            perf.record.unit
                          )}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-neutral-500">
                        ELO {Math.round(perf.eloScore)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

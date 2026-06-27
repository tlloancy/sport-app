import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Sport</h1>
      <p className="mt-3 text-lg text-neutral-600 text-balance">
        Poste ta perf. Elle t&apos;appartient.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/feed"
          className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-medium text-white"
        >
          Voir le feed
        </Link>
        <Link
          href="/upload"
          className="inline-flex h-11 items-center justify-center rounded-md border border-neutral-300 px-5 text-sm font-medium text-neutral-900"
        >
          Poster une perf
        </Link>
      </div>
    </main>
  );
}

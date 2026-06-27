'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const UNITS = ['kg', 's', 'm', 'reps'] as const;

const fieldClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-neutral-900';

export default function UploadClient() {
  const router = useRouter();
  const [movement, setMovement] = useState('snatch');
  const [value, setValue] = useState('35');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('kg');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Sélectionne une vidéo');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const chunkForm = new FormData();
      chunkForm.append('file', file);
      const chunkRes = await fetch('/api/chunk', { method: 'POST', body: chunkForm });
      const chunkData = await chunkRes.json();
      if (!chunkRes.ok) throw new Error(chunkData.error ?? 'chunk failed');

      const pubRes = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement,
          value: Number(value),
          unit,
          videoHash: chunkData.videoHash,
          chunkManifest: chunkData.chunkManifest,
        }),
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok) throw new Error(pubData.error ?? 'publish failed');

      router.push(
        `/performance/${pubData.rkey}?did=${encodeURIComponent(pubData.did)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        data-testid="upload-file"
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className={fieldClass}
      />

      <input
        data-testid="upload-movement"
        type="text"
        value={movement}
        onChange={(e) => setMovement(e.target.value)}
        placeholder="Mouvement"
        required
        className={fieldClass}
      />

      <input
        data-testid="upload-value"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Valeur"
        required
        className={fieldClass}
      />

      <select
        data-testid="upload-unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}
        className={fieldClass}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>

      <button
        data-testid="upload-submit"
        type="submit"
        disabled={busy}
        className="mt-2 h-11 rounded-md bg-neutral-900 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Publication…' : 'Publier'}
      </button>

      {error ? (
        <p data-testid="upload-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const UNITS = ['kg', 's', 'm', 'reps'] as const;

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
      setError('Select a video file');
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
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Video</span>
        <input
          data-testid="upload-file"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Mouvement</span>
        <input
          data-testid="upload-movement"
          type="text"
          value={movement}
          onChange={(e) => setMovement(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Valeur</span>
        <input
          data-testid="upload-value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Unité</span>
        <select
          data-testid="upload-unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}
          className="rounded border px-3 py-2"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>

      <button
        data-testid="upload-submit"
        type="submit"
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
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

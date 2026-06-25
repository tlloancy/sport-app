import UploadClient from './UploadClient';

export default function UploadPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Publier une performance</h1>
      <UploadClient />
    </main>
  );
}

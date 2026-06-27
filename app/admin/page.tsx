import AdminLoginForm from '@/components/admin/AdminLoginForm';
import { verifyAdminSessionToken, ADMIN_COOKIE } from '@/lib/admin-auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AdminPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (verifyAdminSessionToken(token)) {
    redirect('/admin/dashboard');
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <header className="mx-auto max-w-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">Admin</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Connexion</h1>
      </header>
      <AdminLoginForm />
    </main>
  );
}

export const dynamic = 'force-dynamic';

import AdminDashboard from '@/components/admin/AdminDashboard';
import { listCategoriesForAdmin, listPerformancesForAdmin } from '@/lib/admin-data';
import { verifyAdminSessionToken, ADMIN_COOKIE } from '@/lib/admin-auth';
import { listRecentReports } from '@/lib/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminDashboardPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    redirect('/admin');
  }

  const reports = listRecentReports(50).map((r) => ({
    id: r.id,
    uri: r.uri,
    reason: r.reason,
    anonId: r.anon_id ? `${r.anon_id.slice(0, 8)}…` : null,
    createdAt: r.created_at,
  }));

  let performances: Awaited<ReturnType<typeof listPerformancesForAdmin>> = [];
  try {
    performances = await listPerformancesForAdmin();
  } catch {
    performances = [];
  }

  const categories = listCategoriesForAdmin();

  return (
    <main className="min-h-screen bg-white">
      <AdminDashboard
        initialReports={reports}
        initialPerformances={performances}
        initialCategories={categories}
      />
    </main>
  );
}

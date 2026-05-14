import { redirect } from 'next/navigation';
import { requireAdmin, AuthError } from '@/lib/guards';
import AdminLayout from '@/components/admin/AdminLayout';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) {
      redirect('/');
    }
    throw e;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

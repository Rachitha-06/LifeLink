import { useAuthStore } from '@/store/authStore';
import { DonorDashboard } from '@/pages/dashboard/DonorDashboard';
import { RecipientDashboard } from '@/pages/dashboard/RecipientDashboard';
import { HospitalDashboard } from '@/pages/dashboard/HospitalDashboard';
import { AdminDashboard } from '@/pages/dashboard/AdminDashboard';

/** Dispatches to the right role-specific dashboard shell.
 * ProtectedRoute guarantees `user` is non-null by the time this renders. */
export function Dashboard() {
  const role = useAuthStore((s) => s.user?.role);

  switch (role) {
    case 'donor':
      return <DonorDashboard />;
    case 'recipient':
      return <RecipientDashboard />;
    case 'hospital_admin':
      return <HospitalDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return null;
  }
}

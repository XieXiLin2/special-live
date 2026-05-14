import { auth } from './auth';
import { UserRole } from '@/types';

export const getSessionUser = async () => {
  const session = await auth();
  return session?.user ?? null;
};

export const requireAuth = async () => {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized');
  return user;
};

export const requireAdmin = async () => {
  const user = await requireAuth();
  if (user.role !== UserRole.ADMIN) throw new Error('Forbidden');
  return user;
};

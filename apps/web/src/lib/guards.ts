import { auth } from './auth';
import { UserRole } from '@/types';

export class AuthError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}

export const getSessionUser = async () => {
  const session = await auth();
  return session?.user ?? null;
};

export const requireAuth = async () => {
  const user = await getSessionUser();
  if (!user) throw new AuthError('Unauthorized', 401);
  return user;
};

export const requireAdmin = async () => {
  const user = await requireAuth();
  if (user.role !== UserRole.ADMIN) throw new AuthError('Forbidden', 403);
  return user;
};

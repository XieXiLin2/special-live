import NextAuth from 'next-auth';
import Authentik from 'next-auth/providers/authentik';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { AdapterUser } from '@auth/core/adapters';
import { DefaultSession } from 'next-auth';
import { UserRole } from '@/types';
import { prisma } from './prisma';
import { getEnv } from './env';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }
}

const adapter = PrismaAdapter(prisma);

const customAdapter = {
  ...adapter,
  createUser: async (data: AdapterUser) => {
    return await prisma.$transaction(async (tx: any) => {
      const { id: _id, ...rest } = data;
      const created = await tx.user.create({ data: rest as any });

      const adminExists = await tx.user.findFirst({
        where: { role: 'ADMIN' as any },
      });

      if (!adminExists) {
        await tx.user.update({
          where: { id: created.id },
          data: { role: 'ADMIN' as any },
        });
        return { ...created, role: 'ADMIN' } as any;
      }

      return created as any;
    });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: customAdapter,
  providers: [
    Authentik({
      clientId: getEnv().AUTH_AUTHENTIK_ID,
      clientSecret: getEnv().AUTH_AUTHENTIK_SECRET,
      issuer: getEnv().AUTH_AUTHENTIK_ISSUER,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? UserRole.USER;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
});

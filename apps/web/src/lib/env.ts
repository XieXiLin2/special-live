import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
  AUTH_AUTHENTIK_ID: z.string().min(1, 'AUTH_AUTHENTIK_ID is required'),
  AUTH_AUTHENTIK_SECRET: z.string().min(1, 'AUTH_AUTHENTIK_SECRET is required'),
  AUTH_AUTHENTIK_ISSUER: z.string().min(1, 'AUTH_AUTHENTIK_ISSUER is required'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  SRS_CALLBACK_SECRET: z.string().min(1, 'SRS_CALLBACK_SECRET is required'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export const getEnv = (): Env => {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
};

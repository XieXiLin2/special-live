import { randomBytes } from 'crypto';

export function generateStreamKey(): string {
  return randomBytes(16).toString('base64url');
}

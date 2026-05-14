import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export function generateKey(): { plain: string; hash: string } {
  const plain = randomBytes(24).toString('base64url');
  const hash = bcrypt.hashSync(plain, SALT_ROUNDS);
  return { plain, hash };
}

export function verifyKey(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

import { describe, it, expect } from 'vitest';
import { cacheKeys } from '../cache-keys';

describe('cache-keys', () => {
  it('generates correct stream status key', () => {
    expect(cacheKeys.streamStatus('room-1')).toBe('stream:status:room-1');
  });
  it('generates correct active keys set key', () => {
    expect(cacheKeys.activeKeys('room-1')).toBe('stream:active-keys:room-1');
  });
});

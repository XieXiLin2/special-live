import { describe, it, expect } from 'vitest';
import { cacheKeys } from '../cache-keys';

describe('callback-cache key patterns', () => {
  it('generates roomByStreamKey correctly', () => {
    expect(cacheKeys.roomByStreamKey('sk-abc')).toBe('stream:room:sk-abc');
  });
  it('generates activeKeys correctly', () => {
    expect(cacheKeys.activeKeys('room-1')).toBe('stream:active-keys:room-1');
  });
});

export interface MockRoom {
  id: string;
  name: string;
  slug: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  streamKey: string;
  manualMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockStreamKey {
  id: string;
  keyHash: string;
  label: string;
  isActive: boolean;
  roomId: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface MockSiteConfig {
  id: string;
  siteTitle: string;
  faviconUrl: string;
}

export function createMockRoom(overrides: Partial<MockRoom> = {}): MockRoom {
  return {
    id: 'room-test-id',
    name: 'Test Room',
    slug: 'test-room',
    visibility: 'PUBLIC',
    streamKey: 'test-stream-key-123',
    manualMode: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockStreamKey(overrides: Partial<MockStreamKey> = {}): MockStreamKey {
  return {
    id: 'key-test-id',
    keyHash: 'hashed-key-value',
    label: 'Stream Key',
    isActive: true,
    roomId: 'room-test-id',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    expiresAt: null,
    ...overrides,
  };
}

export function createMockSiteConfig(overrides: Partial<MockSiteConfig> = {}): MockSiteConfig {
  return {
    id: 'config-test-id',
    siteTitle: 'Live Stream',
    faviconUrl: '/favicon.ico',
    ...overrides,
  };
}

export function createRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  const { method = 'GET', body, headers = {} } = options;
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function parseJson(response: Response): Promise<any> {
  return response.json();
}

export function setTestEnv(): void {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.AUTH_SECRET = 'test-auth-secret';
  process.env.AUTH_AUTHENTIK_ID = 'test-authentik-id';
  process.env.AUTH_AUTHENTIK_SECRET = 'test-authentik-secret';
  process.env.AUTH_AUTHENTIK_ISSUER = 'https://auth.test.com/application/o/test';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  process.env.SRS_CALLBACK_SECRET = 'test-srs-callback-secret';
  process.env.SRS_HTTP_API_AUTH_USERNAME = 'admin';
  process.env.SRS_HTTP_API_AUTH_PASSWORD = 'admin';
  process.env.SRS_API_URL = 'http://localhost:1985';
}

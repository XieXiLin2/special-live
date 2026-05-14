import { setTestEnv, createMockSiteConfig, createRequest, parseJson } from '../helpers';
setTestEnv();

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/admin/config/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteConfig: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/guards', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', role: 'ADMIN' }),
}));

describe('Site Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get site config', async () => {
    const mockConfig = createMockSiteConfig();
    vi.mocked(prisma.siteConfig.findFirst).mockResolvedValue(mockConfig);

    const response = await GET();
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.config.siteTitle).toBe('Live Stream');
    expect(data.config.faviconUrl).toBe('/favicon.ico');
  });

  it('should return default config when none exists', async () => {
    vi.mocked(prisma.siteConfig.findFirst).mockResolvedValue(null);

    const response = await GET();
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.config.siteTitle).toBe('Live Stream');
    expect(data.config.faviconUrl).toBe('/favicon.ico');
  });

  it('should update site title', async () => {
    const existingConfig = createMockSiteConfig();
    const updatedConfig = createMockSiteConfig({ siteTitle: 'My Stream Platform' });

    vi.mocked(prisma.siteConfig.findFirst).mockResolvedValue(existingConfig);
    vi.mocked(prisma.siteConfig.update).mockResolvedValue(updatedConfig);

    const request = createRequest('http://localhost:3000/api/admin/config', {
      method: 'PATCH',
      body: { siteTitle: 'My Stream Platform' },
    });

    const response = await PATCH(request);
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.config.siteTitle).toBe('My Stream Platform');
  });

  it('should create config when none exists during update', async () => {
    const newConfig = createMockSiteConfig({ siteTitle: 'New Platform' });

    vi.mocked(prisma.siteConfig.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.siteConfig.create).mockResolvedValue(newConfig);

    const request = createRequest('http://localhost:3000/api/admin/config', {
      method: 'PATCH',
      body: { siteTitle: 'New Platform' },
    });

    const response = await PATCH(request);
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.config.siteTitle).toBe('New Platform');
    expect(vi.mocked(prisma.siteConfig.create)).toHaveBeenCalled();
  });

  it('should update favicon url', async () => {
    const existingConfig = createMockSiteConfig();
    const updatedConfig = createMockSiteConfig({ faviconUrl: '/custom-favicon.ico' });

    vi.mocked(prisma.siteConfig.findFirst).mockResolvedValue(existingConfig);
    vi.mocked(prisma.siteConfig.update).mockResolvedValue(updatedConfig);

    const request = createRequest('http://localhost:3000/api/admin/config', {
      method: 'PATCH',
      body: { faviconUrl: '/custom-favicon.ico' },
    });

    const response = await PATCH(request);
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.config.faviconUrl).toBe('/custom-favicon.ico');
  });
});

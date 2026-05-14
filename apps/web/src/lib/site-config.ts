import { prisma } from './prisma';
import { SiteConfigDTO } from '@/types';

let cache: { config: SiteConfigDTO; expiry: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getSiteConfig(): Promise<SiteConfigDTO> {
  if (cache && cache.expiry > Date.now()) {
    return cache.config;
  }

  const config = await prisma.siteConfig.findFirst();
  if (!config) {
    return { id: '', siteTitle: 'Live Stream', faviconUrl: '/favicon.ico' };
  }

  const dto: SiteConfigDTO = {
    id: config.id,
    siteTitle: config.siteTitle,
    faviconUrl: config.faviconUrl,
  };

  cache = { config: dto, expiry: Date.now() + CACHE_TTL_MS };
  return dto;
}

export async function updateSiteConfig(data: { siteTitle?: string; faviconUrl?: string }): Promise<SiteConfigDTO> {
  const config = await prisma.siteConfig.findFirst();

  let updated;
  if (config) {
    updated = await prisma.siteConfig.update({
      where: { id: config.id },
      data,
    });
  } else {
    updated = await prisma.siteConfig.create({
      data: {
        siteTitle: data.siteTitle || 'Live Stream',
        faviconUrl: data.faviconUrl || '/favicon.ico',
      },
    });
  }

  cache = null;

  return {
    id: updated.id,
    siteTitle: updated.siteTitle,
    faviconUrl: updated.faviconUrl,
  };
}

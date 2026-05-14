'use client';

import { useEffect, useRef } from 'react';
import type Artplayer from 'artplayer';
import { flvCustomType, destroyFlvPlayer } from '@/lib/player/flv-loader';
import { hlsCustomType, destroyHlsPlayer } from '@/lib/player/hls-loader';

export interface ArtPlayerWrapperProps {
  url: string;
  type?: string;
}

export function ArtPlayerWrapper({ url, type = 'flv' }: ArtPlayerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);

  useEffect(() => {
    let destroyed = false;

    const initPlayer = async () => {
      if (!containerRef.current) return;

      const ArtPlayer = (await import('artplayer')).default;

      if (destroyed) return;

      const art = new ArtPlayer({
        container: containerRef.current,
        url,
        type,
        autoplay: true,
        fullscreen: true,
        theme: '#ff0057',
        lang: 'zh-cn',
        autoSize: true,
        autoMini: true,
        setting: true,
        pip: true,
        customType: {
          flv: flvCustomType,
          hls: hlsCustomType,
        },
      });

      artRef.current = art;
    };

    initPlayer();

    return () => {
      destroyed = true;
      if (artRef.current) {
        const art = artRef.current;
        destroyFlvPlayer(art);
        destroyHlsPlayer(art);
        art.destroy();
        artRef.current = null;
      }
    };
  }, [url, type]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
      }}
    />
  );
}

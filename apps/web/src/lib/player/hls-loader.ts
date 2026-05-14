import type Artplayer from 'artplayer';

export async function hlsCustomType(
  this: Artplayer,
  video: HTMLVideoElement,
  url: string,
  art: Artplayer,
) {
  const canUseNativeHLS = typeof video.canPlayType === 'function'
    && video.canPlayType('application/vnd.apple.mpegurl');

  if (!canUseNativeHLS) {
    art.notice.show = 'HLS playback not supported in this browser';
    return;
  }

  video.src = url;
  video.load();

  (art as unknown as { hls: unknown }).hls = { video };
}

export function destroyHlsPlayer(art: Artplayer) {
  const hls = art.hls as { video?: HTMLVideoElement } | null | undefined;
  if (hls?.video) {
    hls.video.src = '';
    hls.video.removeAttribute('src');
  }
  art.hls = null;
}

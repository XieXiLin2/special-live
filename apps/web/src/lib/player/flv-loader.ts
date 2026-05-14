import type Artplayer from 'artplayer';

let MpegtsModule: typeof import('mpegts.js') | null = null;

export async function flvCustomType(
  this: Artplayer,
  video: HTMLVideoElement,
  url: string,
  art: Artplayer,
) {
  if (!MpegtsModule) {
    MpegtsModule = await import('mpegts.js');
  }

  const mpegts = MpegtsModule.default;

  if (!mpegts.getFeatureList().mseLivePlayback) {
    art.notice.show = 'FLV not supported';
    return;
  }

  let reconnectAttempts = 0;
  const maxAttempts = 5;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const createAndAttachPlayer = () => {
    const player = mpegts.createPlayer(
      { type: 'flv', url, isLive: true },
      {
        enableWorker: true,
        lazyLoad: false,
        liveBufferLatencyChasing: true,
        isLive: true,
      },
    );

    player.attachMediaElement(video);
    player.load();

    player.on(mpegts.Events.ERROR, (errorType: string, errorDetail: string) => {
      if (errorType === mpegts.ErrorTypes.NETWORK_ERROR) {
        if (!video.isConnected) return;

        if (reconnectAttempts < maxAttempts) {
          destroyFlvPlayer(art);

          if (!video.isConnected) return;

          art.notice.show = `Reconnecting... (${reconnectAttempts + 1}/${maxAttempts})`;

          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000);

          reconnectTimer = setTimeout(() => {
            if (!video.isConnected) return;
            reconnectAttempts++;
            createAndAttachPlayer();
          }, delay);

          (
            art as unknown as {
              flvReconnectTimer?: ReturnType<typeof setTimeout>;
            }
          ).flvReconnectTimer = reconnectTimer;
        } else {
          art.notice.show = 'Stream unavailable. Please refresh the page.';
          art.emit('error', new Error('Max reconnection attempts reached'), 0);
        }
      } else {
        art.notice.show = `Playback error: ${errorDetail}`;
        art.emit('error', new Error(`mpegts.js: ${errorDetail}`), 0);
      }
    });

    player.on(mpegts.Events.LOADING_COMPLETE, () => {
      reconnectAttempts = 0;
      art.notice.show = '';
    });

    player.on(mpegts.Events.MEDIA_INFO, (info: unknown) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[mpegts.js] Media info:', info);
      }
    });

    (art as unknown as { flv: unknown }).flv = player;
  };

  createAndAttachPlayer();

  return art.flv;
}

export function destroyFlvPlayer(art: Artplayer) {
  const timer = (
    art as unknown as {
      flvReconnectTimer?: ReturnType<typeof setTimeout>;
    }
  ).flvReconnectTimer;
  if (timer) {
    clearTimeout(timer);
    (
      art as unknown as {
        flvReconnectTimer?: ReturnType<typeof setTimeout>;
      }
    ).flvReconnectTimer = undefined;
  }

  const flv = art.flv as { destroy?: () => void } | null | undefined;
  if (flv && typeof flv.destroy === 'function') {
    flv.destroy();
  }
  art.flv = null;
}

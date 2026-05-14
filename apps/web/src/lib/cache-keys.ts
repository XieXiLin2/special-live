export const cacheKeys = {
  streamStatus: (roomId: string) => `stream:status:${roomId}`,
  streamKey: (keyHash: string) => `stream:key:${keyHash}`,
  roomByStreamKey: (streamKey: string) => `stream:room:${streamKey}`,
  publishToken: (token: string) => `publish:token:${token}`,
  accessToken: (token: string) => `access:token:${token}`,
  roomVisibility: (roomId: string) => `stream:visibility:${roomId}`,
  activeKeys: (roomId: string) => `stream:active-keys:${roomId}`,
  rateLimit: (ip: string, action: string) => `rate:${action}:${ip}`,
};

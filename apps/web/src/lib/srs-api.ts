const SRS_API_BASE = process.env.SRS_API_URL || 'http://localhost:1985';
const SRS_API_USER = process.env.SRS_HTTP_API_AUTH_USERNAME || 'admin';
const SRS_API_PASS = process.env.SRS_HTTP_API_AUTH_PASSWORD || 'admin';

export async function getSRSStreamStatus(streamKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${SRS_API_BASE}/api/v1/streams`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${SRS_API_USER}:${SRS_API_PASS}`).toString('base64')}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    const streams = data.streams || [];
    return streams.some((s: any) => s.name === streamKey);
  } catch (error) {
    return false;
  }
}

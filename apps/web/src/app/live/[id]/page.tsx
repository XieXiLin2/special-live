'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { Result, Button, Spin, Input } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { needsHLSFallback } from '@/lib/player/platform';
import { ArtPlayerWrapper } from '@/components/player/ArtPlayerWrapper';

export default function LivePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [streamType, setStreamType] = useState<string>('flv');

  const [accessGranted, setAccessGranted] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');

  const validateKey = useCallback(
    async (key: string) => {
      setCheckingKey(true);
      setKeyError(null);
      try {
        const res = await fetch(`/api/rooms/${slug}/verify-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });

        if (res.status === 429) {
          setKeyError('Too many attempts. Please try again later.');
          setCheckingKey(false);
          return;
        }

        if (!res.ok) {
          setKeyError('Failed to validate key. Please try again.');
          setCheckingKey(false);
          return;
        }

        const data = await res.json();
        if (data.valid) {
          setAccessGranted(true);
        } else {
          setKeyError('Access Denied: Invalid or expired key');
        }
      } catch {
        setKeyError('Failed to validate key. Please try again.');
      } finally {
        setCheckingKey(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchRoom = async () => {
      setLoading(true);
      setNotFound(false);
      setError(null);

      try {
        const res = await fetch(`/api/rooms/${slug}`);

        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!res.ok) {
          if (!cancelled) setError('Failed to load room data');
          return;
        }

        const data = await res.json();
        const room = data.room;

        if (room.visibility === 'PRIVATE') {
          const isAuthenticated = sessionStatus === 'authenticated';
          if (isAuthenticated) {
            if (!cancelled) setAccessGranted(true);
          } else {
            const keyFromUrl = searchParams.get('key');
            if (keyFromUrl) {
              if (!cancelled) {
                setCheckingKey(true);
              }
              const verifyRes = await fetch(`/api/rooms/${slug}/verify-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: keyFromUrl }),
              });

              if (verifyRes.status === 429) {
                if (!cancelled) {
                  setKeyError('Too many attempts. Please try again later.');
                  setCheckingKey(false);
                }
                return;
              }

              if (!verifyRes.ok) {
                if (!cancelled) {
                  setKeyError('Failed to validate key. Please try again.');
                  setCheckingKey(false);
                }
                return;
              }

              const verifyData = await verifyRes.json();
              if (verifyData.valid) {
                if (!cancelled) setAccessGranted(true);
              } else {
                if (!cancelled) setKeyError('Access Denied: Invalid or expired key');
              }
              if (!cancelled) setCheckingKey(false);
              return;
            }
          }
        } else {
          if (!cancelled) setAccessGranted(true);
        }

        let url = `/live/${slug}.flv`;

        if (room.manualMode) {
          try {
            const sourcesRes = await fetch(`/api/rooms/${room.id}/sources`);
            if (sourcesRes.ok) {
              const sourcesData = await sourcesRes.json();
              const sources = sourcesData.sources || [];
              if (sources.length > 0 && sources[0].qualities?.length > 0) {
                url = sources[0].qualities[0].url;
              }
            }
          } catch {
          }
        }

        let type: string;
        let finalUrl: string;

        if (needsHLSFallback()) {
          type = 'hls';
          finalUrl = `/live/${slug}.m3u8`;
        } else {
          type = 'flv';
          finalUrl = url;
        }

        if (!cancelled) {
          setStreamUrl(finalUrl);
          setStreamType(type);
        }
      } catch {
        if (!cancelled) setError('Failed to connect to server');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRoom();

    return () => {
      cancelled = true;
    };
  }, [slug, sessionStatus, searchParams]);

  const handleKeySubmit = () => {
    if (!inputKey.trim()) return;
    validateKey(inputKey.trim());
  };

  if (loading || checkingKey || sessionStatus === 'loading') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#141414',
        }}
      >
        <Result
          status="404"
          title="Room Not Found"
          subTitle="The stream room you are looking for does not exist."
          extra={
            <Button type="primary" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#141414',
        }}
      >
        <Result
          status="error"
          title="Error"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          }
        />
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#141414',
        }}
      >
        {keyError ? (
          <Result
            status="403"
            title="Access Denied"
            subTitle={keyError}
            extra={
              <Button type="primary" onClick={() => router.push('/')}>
                Back to Home
              </Button>
            }
          />
        ) : (
          <Result
            status="403"
            title="Private Room"
            subTitle="This room is private. Please enter an access key to continue."
            extra={
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Input.Password
                  placeholder="Enter access key"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  onPressEnter={handleKeySubmit}
                  style={{ width: 240 }}
                />
                <Button type="primary" onClick={handleKeySubmit} loading={checkingKey}>
                  Access
                </Button>
              </div>
            }
          />
        )}
      </div>
    );
  }

  return <ArtPlayerWrapper url={streamUrl} type={streamType} />;
}

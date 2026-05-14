'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Spin, Alert, Empty, Button, Typography } from 'antd';
import MainLayout from '@/components/layout/MainLayout';

const { Title } = Typography;

interface PublicRoom {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  manualMode: boolean;
  createdAt: string;
}

export default function Home() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data.rooms ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <MainLayout>
      <Title level={2} style={{ marginBottom: 24 }}>
        Stream Rooms
      </Title>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && error && (
        <Alert
          type="error"
          message="Failed to load rooms"
          description={error}
          showIcon
          action={
            <Button size="small" danger onClick={fetchRooms}>
              Retry
            </Button>
          }
        />
      )}

      {!loading && !error && rooms.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Empty description="No streams available" />
        </div>
      )}

      {!loading && !error && rooms.length > 0 && (
        <Row gutter={[16, 16]}>
          {rooms.map((room) => (
            <Col key={room.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                title={room.name}
                onClick={() => router.push(`/live/${room.slug}`)}
              />
            </Col>
          ))}
        </Row>
      )}
    </MainLayout>
  );
}

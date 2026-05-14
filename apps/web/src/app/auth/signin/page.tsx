'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Card, Button, Spin, Space, Typography } from 'antd';
import { LoginOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SignInPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const handleSignIn = () => {
    setLoading(true);
    signIn('authentik', { callbackUrl: '/' });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          textAlign: 'center',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={3} style={{ marginBottom: 0 }}>
            Welcome Back
          </Title>
          <Text type="secondary">Sign in to access your live streaming dashboard</Text>
          <Button
            type="primary"
            size="large"
            icon={<LoginOutlined />}
            loading={loading}
            onClick={handleSignIn}
            block
          >
            {loading ? 'Redirecting…' : 'Sign in with Authentik'}
          </Button>
        </Space>
      </Card>
    </div>
  );
}

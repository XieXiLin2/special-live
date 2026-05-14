'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from 'antd';
import { LoginOutlined } from '@ant-design/icons';

export default function SignInButton() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = () => {
    setLoading(true);
    signIn('authentik');
  };

  return (
    <Button
      type="primary"
      icon={<LoginOutlined />}
      loading={loading}
      onClick={handleSignIn}
    >
      {loading ? 'Signing in…' : 'Sign In'}
    </Button>
  );
}

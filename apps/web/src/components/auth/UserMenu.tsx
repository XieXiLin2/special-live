'use client';

import { signOut, useSession } from 'next-auth/react';
import { Avatar, Dropdown, Button, Space, Typography, Skeleton } from 'antd';
import type { MenuProps } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Space>
        <Skeleton.Avatar active size="small" />
        <Skeleton.Input active size="small" style={{ width: 80 }} />
      </Space>
    );
  }

  if (status === 'unauthenticated' || !session?.user) {
    return null;
  }

  const { user } = session;

  const items: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <Text strong>{user.name ?? user.email}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user.email}
          </Text>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'sign-out',
      label: 'Sign Out',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => signOut({ callbackUrl: '/' }),
    },
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
      <Button
        type="text"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 'auto',
          padding: '4px 8px',
        }}
      >
        <Avatar
          src={user.image}
          icon={!user.image ? <UserOutlined /> : undefined}
          size="small"
        />
        <Text style={{ maxWidth: 120 }} ellipsis>
          {user.name ?? user.email}
        </Text>
      </Button>
    </Dropdown>
  );
}

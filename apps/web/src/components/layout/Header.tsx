'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { Layout, Avatar, Button, Dropdown, Typography, Space, theme } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  LoginOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { UserRole } from '@/types';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

export default function Header() {
  const { data: session } = useSession();
  const { token } = theme.useToken();

  const user = session?.user;

  return (
    <AntHeader
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Text strong style={{ fontSize: 18, color: token.colorText }}>
        Live Stream
      </Text>

      <Space>
        {user ? (
          <Dropdown
            menu={{
              items: [
                ...(user.role === UserRole.ADMIN
                  ? [
                      {
                        key: 'admin',
                        label: 'Admin Panel',
                        icon: <SettingOutlined />,
                      },
                    ]
                  : []),
                { type: 'divider' as const },
                {
                  key: 'signout',
                  label: 'Sign Out',
                  icon: <LogoutOutlined />,
                  danger: true,
                },
              ],
              onClick: ({ key }) => {
                if (key === 'signout') signOut();
              },
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                src={user.image}
                icon={<UserOutlined />}
                size="small"
              />
              <Text style={{ color: token.colorText }}>
                {user.name || user.email}
              </Text>
            </Space>
          </Dropdown>
        ) : (
          <Button type="primary" icon={<LoginOutlined />} onClick={() => signIn()}>
            Sign In
          </Button>
        )}
      </Space>
    </AntHeader>
  );
}

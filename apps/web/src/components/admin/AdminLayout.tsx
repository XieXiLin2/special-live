'use client';

import { useState } from 'react';
import { Layout, Menu, Breadcrumb, Avatar, Typography, theme, Space } from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  AppstoreOutlined,
  KeyOutlined,
  LinkOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import type { MenuProps } from 'antd';

const { Sider, Content, Header: AntHeader } = Layout;
const { Text } = Typography;

const breadcrumbMap: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/config': 'Site Config',
  '/admin/rooms': 'Rooms',
  '/admin/keys': 'Keys',
  '/admin/sources': 'Sources',
};

const adminMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/admin/config',
    icon: <SettingOutlined />,
    label: 'Site Config',
  },
  {
    key: '/admin/rooms',
    icon: <AppstoreOutlined />,
    label: 'Rooms',
  },
  {
    key: '/admin/keys',
    icon: <KeyOutlined />,
    label: 'Keys',
  },
  {
    key: '/admin/sources',
    icon: <LinkOutlined />,
    label: 'Sources',
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  const user = session?.user;

  const currentLabel = breadcrumbMap[pathname] || pathname;

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    router.push(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={80}
        theme="dark"
      >
        <div
          style={{
            height: 32,
            margin: 16,
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: collapsed ? 14 : 16,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {collapsed ? 'A' : 'Admin'}
          </span>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={adminMenuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout>
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
          <Breadcrumb
            items={[
              { title: 'Admin' },
              { title: currentLabel },
            ]}
          />

          {user && (
            <Space>
              <Avatar
                src={user.image}
                icon={<UserOutlined />}
                size="small"
              />
              <Text style={{ color: token.colorText }}>
                {user.name || user.email}
              </Text>
            </Space>
          )}
        </AntHeader>

        <Content style={{ padding: 24 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

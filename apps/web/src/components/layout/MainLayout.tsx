'use client';

import { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import type { MenuProps } from 'antd';
import { UserRole } from '@/types';
import Header from './Header';

const { Sider, Content } = Layout;

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const user = session?.user;

  const selectedKey = (() => {
    if (pathname === '/') return '/';
    if (pathname.startsWith('/admin')) return '/admin';
    return '/';
  })();

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Home',
    },
    ...(user?.role === UserRole.ADMIN
      ? [
          {
            key: '/admin',
            icon: <SettingOutlined />,
            label: 'Admin',
          } as const,
        ]
      : []),
  ];

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
            {collapsed ? 'LS' : 'Live Stream'}
          </span>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout>
        <Header />
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AntdRegistry>
        <ConfigProvider
          theme={{
            algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
          }}
        >
          {children}
        </ConfigProvider>
      </AntdRegistry>
    </SessionProvider>
  );
}

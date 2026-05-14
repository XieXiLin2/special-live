import type { Metadata } from 'next';
import 'antd/dist/reset.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Live Stream',
  description: 'Live streaming platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

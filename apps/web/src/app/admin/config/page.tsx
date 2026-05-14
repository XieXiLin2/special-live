'use client';

import { useEffect, useState } from 'react';
import { Form, Input, Button, Image, Spin, Typography, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { SiteConfigDTO } from '@/types';

const { Title } = Typography;

export default function AdminConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState('');

  useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((data: { config: SiteConfigDTO }) => {
        const { config } = data;
        form.setFieldsValue({
          siteTitle: config.siteTitle,
          faviconUrl: config.faviconUrl,
        });
        setFaviconUrl(config.faviconUrl);
      })
      .catch(() => {
        message.error('Failed to load settings');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [form]);

  const handleSubmit = async (values: { siteTitle: string; faviconUrl: string }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update settings');
      }

      setFaviconUrl(values.faviconUrl);
      message.success('Settings updated');
    } catch {
      message.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <SettingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>
          Site Config
        </Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ siteTitle: '', faviconUrl: '' }}
      >
        <Form.Item
          name="siteTitle"
          label="Site Title"
          rules={[{ required: true, message: 'Please enter a site title' }]}
        >
          <Input placeholder="Enter site title" />
        </Form.Item>

        <Form.Item
          name="faviconUrl"
          label="Favicon URL"
          rules={[
            { required: true, message: 'Please enter a favicon URL' },
            { type: 'url', message: 'Please enter a valid URL' },
          ]}
        >
          <Input
            placeholder="https://example.com/favicon.ico"
            onChange={(e) => setFaviconUrl(e.target.value)}
          />
        </Form.Item>

        {faviconUrl && (
          <Form.Item label="Preview">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                border: '1px solid #d9d9d9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: '#fafafa',
              }}
            >
              <Image
                src={faviconUrl}
                alt="Favicon preview"
                width={32}
                height={32}
                preview={false}
                fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI0IiBmaWxsPSIjZjBmMGYwIi8+PHBhdGggZD0iTTE2IDhMMjAgMTZIMTJMMTYgOFoiIGZpbGw9IiNiZmJmYmYiLz48L3N2Zz4="
              />
            </div>
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

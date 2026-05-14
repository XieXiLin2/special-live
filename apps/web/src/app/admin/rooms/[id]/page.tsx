'use client';

import { useCallback, useEffect, useState, use } from 'react';
import {
  Button,
  Form,
  Input,
  Radio,
  Tabs,
  Typography,
  Spin,
  Result,
  Space,
  message,
  Table,
  Switch,
  Modal,
  Tag,
  Alert,
  Card,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { StreamRoomVisibility } from '@/types';
import type { StreamRoomDTO, StreamKeyDTO, PlaySourceDTO, PlaySourceQualityDTO } from '@/types';

const { Title, Text } = Typography;

export default function AdminRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<StreamRoomDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [keys, setKeys] = useState<StreamKeyDTO[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateLabel, setGenerateLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPlain, setGeneratedPlain] = useState<string | null>(null);

  const [sources, setSources] = useState<PlaySourceDTO[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [qualities, setQualities] = useState<{ label: string; url: string }[]>([{ label: '', url: '' }]);
  const [savingSource, setSavingSource] = useState(false);

  const [activeTab, setActiveTab] = useState('general');

  const fetchRoom = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to load room');
        return;
      }
      const data = await res.json();
      setRoom(data.room);
      form.setFieldsValue({
        name: data.room.name,
        visibility: data.room.visibility,
        slug: data.room.slug,
      });
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [roomId, form]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/keys`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setKeysError(data.error || 'Failed to load keys');
        return;
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      setKeysError('Failed to connect to server');
    } finally {
      setKeysLoading(false);
    }
  }, [roomId]);

  const toggleKeyActive = useCallback(async (keyId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        message.error(data.error || 'Failed to update key');
        fetchKeys();
        return;
      }
      message.success(isActive ? 'Key activated' : 'Key deactivated');
    } catch {
      message.error('Failed to update key');
      fetchKeys();
    }
  }, [fetchKeys]);

  const deleteKey = useCallback((keyId: string) => {
    Modal.confirm({
      title: 'Delete Stream Key',
      content: 'Active streams using this key will be disconnected. Are you sure you want to delete this key?',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/keys/${keyId}`, { method: 'DELETE' });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            message.error(data.error || 'Failed to delete key');
            return;
          }
          message.success('Key deleted');
          fetchKeys();
        } catch {
          message.error('Failed to delete key');
        }
      },
    });
  }, [fetchKeys]);

  const handleGenerateKey = useCallback(async () => {
    if (!generateLabel.trim()) {
      message.error('Please enter a label');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: generateLabel.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        message.error(data.error || 'Failed to generate key');
        return;
      }
      const data = await res.json();
      setGeneratedPlain(data.key.plain);
    } catch {
      message.error('Failed to generate key');
    } finally {
      setGenerating(false);
    }
  }, [roomId, generateLabel]);

  const closeGenerateModal = useCallback(() => {
    setGenerateOpen(false);
    setGenerateLabel('');
    setGeneratedPlain(null);
    fetchKeys();
  }, [fetchKeys]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('Copied to clipboard');
    }).catch(() => {
      message.error('Failed to copy');
    });
  }, []);

  const fetchSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/sources`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSourcesError(data.error || 'Failed to load sources');
        return;
      }
      const data = await res.json();
      setSources(data.sources || []);
    } catch {
      setSourcesError('Failed to connect to server');
    } finally {
      setSourcesLoading(false);
    }
  }, [roomId]);

  const deleteSource = useCallback((sourceId: string) => {
    Modal.confirm({
      title: 'Delete Play Source',
      content: 'Are you sure you want to delete this play source?',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/sources/${sourceId}`, { method: 'DELETE' });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            message.error(data.error || 'Failed to delete source');
            return;
          }
          message.success('Source deleted');
          fetchSources();
        } catch {
          message.error('Failed to delete source');
        }
      },
    });
  }, [fetchSources]);

  const handleSaveSource = useCallback(async () => {
    if (!sourceName.trim()) {
      message.error('Please enter a source name');
      return;
    }
    const validQualities = qualities.filter(q => q.label.trim() && q.url.trim());
    if (validQualities.length === 0) {
      message.error('At least one quality is required');
      return;
    }
    setSavingSource(true);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sourceName.trim(),
          qualities: validQualities.map(q => ({ label: q.label.trim(), url: q.url.trim() })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        message.error(data.error || 'Failed to create source');
        return;
      }
      message.success('Play source created');
      setSourceFormOpen(false);
      setSourceName('');
      setQualities([{ label: '', url: '' }]);
      fetchSources();
    } catch {
      message.error('Failed to create source');
    } finally {
      setSavingSource(false);
    }
  }, [roomId, sourceName, qualities, fetchSources]);

  const addQualityRow = useCallback(() => {
    setQualities(prev => [...prev, { label: '', url: '' }]);
  }, []);

  const updateQuality = useCallback((index: number, field: 'label' | 'url', value: string) => {
    setQualities(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeQualityRow = useCallback((index: number) => {
    setQualities(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          visibility: values.visibility,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        message.error(data.error || 'Failed to save room');
        return;
      }

      const data = await res.json();
      setRoom(data.room);
      form.setFieldsValue({
        name: data.room.name,
        visibility: data.room.visibility,
        slug: data.room.slug,
      });
      message.success('Room saved');
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      message.error('Failed to save room');
    } finally {
      setSaving(false);
    }
  }, [roomId, form]);

  const onNameChange = useCallback(() => {
    const name = form.getFieldValue('name');
    if (name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      form.setFieldsValue({ slug: generatedSlug });
    } else {
      form.setFieldsValue({ slug: '' });
    }
  }, [form]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    if (key === 'keys' && keys.length === 0 && !keysLoading) {
      fetchKeys();
    }
    if (key === 'sources' && sources.length === 0 && !sourcesLoading) {
      fetchSources();
    }
  }, [fetchKeys, fetchSources, keys.length, keysLoading, sources.length, sourcesLoading]);

  const tabItems = [
    {
      key: 'general',
      label: 'General',
      children: (
        <div style={{ maxWidth: 480 }}>
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please enter a room name' }]}
              normalize={(value: string) => value || ''}
              getValueFromEvent={(e: React.ChangeEvent<HTMLInputElement>) => {
                onNameChange();
                return e.target.value;
              }}
            >
              <Input placeholder="Enter room name" />
            </Form.Item>

            <Form.Item name="slug" label="Slug">
              <Input disabled placeholder="Auto-generated from name" />
            </Form.Item>

            <Form.Item name="visibility" label="Visibility">
              <Radio.Group>
                <Radio value={StreamRoomVisibility.PUBLIC}>Public</Radio>
                <Radio value={StreamRoomVisibility.PRIVATE}>Private</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: 'keys',
      label: 'Keys',
      children: (
        <div style={{ maxWidth: 640 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              Stream Keys
            </Title>
            <Button
              type="primary"
              icon={<KeyOutlined />}
              onClick={() => setGenerateOpen(true)}
            >
              Generate New Key
            </Button>
          </div>

          {keysError && (
            <Alert
              type="error"
              message={keysError}
              showIcon
              style={{ marginBottom: 16 }}
              action={
                <Button size="small" onClick={fetchKeys}>
                  Retry
                </Button>
              }
            />
          )}

          <Table<StreamKeyDTO>
            dataSource={keys}
            rowKey="id"
            loading={keysLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: 'No stream keys yet. Generate one to get started.' }}
          >
            <Table.Column<StreamKeyDTO>
              title="Label"
              dataIndex="label"
              key="label"
              render={(label: string) => (
                <Text strong>{label}</Text>
              )}
            />
            <Table.Column<StreamKeyDTO>
              title="Status"
              dataIndex="isActive"
              key="isActive"
              width={120}
              render={(isActive: boolean, record: StreamKeyDTO) => (
                <Switch
                  checked={isActive}
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                  onChange={(checked) => {
                    setKeys(prev =>
                      prev.map(k => (k.id === record.id ? { ...k, isActive: checked } : k))
                    );
                    toggleKeyActive(record.id, checked);
                  }}
                />
              )}
            />
            <Table.Column<StreamKeyDTO>
              title="Created"
              dataIndex="createdAt"
              key="createdAt"
              width={180}
              render={(createdAt: Date) =>
                new Date(createdAt).toLocaleString()
              }
            />
            <Table.Column<StreamKeyDTO>
              title=""
              key="actions"
              width={80}
              render={(_: unknown, record: StreamKeyDTO) => (
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => deleteKey(record.id)}
                />
              )}
            />
          </Table>

          {/* Generate Key Modal */}
          <Modal
            title="Generate New Stream Key"
            open={generateOpen}
            onCancel={closeGenerateModal}
            footer={generatedPlain ? null : [
              <Button key="cancel" onClick={closeGenerateModal}>
                Cancel
              </Button>,
              <Button
                key="generate"
                type="primary"
                loading={generating}
                onClick={handleGenerateKey}
              >
                Generate Key
              </Button>,
            ]}
          >
            {!generatedPlain ? (
              <div style={{ padding: '8px 0' }}>
                <Text style={{ display: 'block', marginBottom: 12 }}>
                  Enter a label for this stream key:
                </Text>
                <Input
                  placeholder="e.g., OBS Studio, Streamlabs"
                  value={generateLabel}
                  onChange={e => setGenerateLabel(e.target.value)}
                  onPressEnter={handleGenerateKey}
                  autoFocus
                />
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                <Alert
                  type="warning"
                  message="Save this key now — it won't be shown again"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Stream Key:
                  </Text>
                  <Input.Search
                    readOnly
                    value={generatedPlain}
                    enterButton={<CopyOutlined />}
                    onSearch={() => copyToClipboard(generatedPlain)}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Button type="primary" onClick={closeGenerateModal}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      ),
    },
    {
      key: 'sources',
      label: 'Play Sources',
      children: (
        <div style={{ maxWidth: 720 }}>
          {room && !room.manualMode && (
            <Alert
              type="info"
              message="Manual Mode Required"
              description="Play sources override default FLV playback when manual mode is enabled. Enable manual mode in the General tab to activate play sources."
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              Play Sources
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSourceFormOpen(true);
                setSourceName('');
                setQualities([{ label: '', url: '' }]);
              }}
            >
              Add Source
            </Button>
          </div>

          {sourcesError && (
            <Alert
              type="error"
              message={sourcesError}
              showIcon
              style={{ marginBottom: 16 }}
              action={
                <Button size="small" onClick={fetchSources}>
                  Retry
                </Button>
              }
            />
          )}

          {sourcesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin />
            </div>
          ) : sources.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Typography.Text type="secondary">
                No play sources configured. Add one to get started.
              </Typography.Text>
            </div>
          ) : (
            sources.map((source) => (
              <Card
                key={source.id}
                size="small"
                title={source.name}
                style={{ marginBottom: 12 }}
                extra={
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => deleteSource(source.id)}
                  />
                }
              >
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {source.qualities.length} quality / qualities
                  </Text>
                </div>
                {source.qualities.length === 0 ? (
                  <Text type="secondary">No qualities configured</Text>
                ) : (
                  <Table<PlaySourceQualityDTO>
                    dataSource={source.qualities}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    showHeader={false}
                  >
                    <Table.Column<PlaySourceQualityDTO>
                      dataIndex="label"
                      key="label"
                      width={120}
                      render={(label: string) => (
                        <Tag color="blue">{label}</Tag>
                      )}
                    />
                    <Table.Column<PlaySourceQualityDTO>
                      dataIndex="url"
                      key="url"
                      render={(url: string) => (
                        <Text style={{ fontFamily: 'monospace', fontSize: 13 }} copyable>
                          {url}
                        </Text>
                      )}
                    />
                  </Table>
                )}
              </Card>
            ))
          )}

          {/* Add Source Modal */}
          <Modal
            title="Add Play Source"
            open={sourceFormOpen}
            onCancel={() => setSourceFormOpen(false)}
            width={560}
            footer={[
              <Button key="cancel" onClick={() => setSourceFormOpen(false)}>
                Cancel
              </Button>,
              <Button
                key="save"
                type="primary"
                loading={savingSource}
                onClick={handleSaveSource}
              >
                Create Source
              </Button>,
            ]}
          >
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  Source Name
                </Text>
                <Input
                  placeholder="e.g., Primary CDN"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  autoFocus
                />
              </div>

              <Divider titlePlacement="left" plain style={{ fontSize: 13 }}>
                Qualities
              </Divider>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                Define at least one quality with a label (e.g., 1080p) and the playback URL.
              </Text>

              {qualities.map((q, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <Input
                    placeholder="Label (e.g., 1080p)"
                    value={q.label}
                    onChange={e => updateQuality(index, 'label', e.target.value)}
                    style={{ width: 130, flexShrink: 0 }}
                  />
                  <Input
                    placeholder="URL (e.g., https://cdn.example.com/stream.m3u8)"
                    value={q.url}
                    onChange={e => updateQuality(index, 'url', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeQualityRow(index)}
                    disabled={qualities.length <= 1}
                    style={{ marginTop: 4 }}
                  />
                </div>
              ))}

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addQualityRow}
                block
                style={{ marginTop: 4 }}
              >
                Add Quality
              </Button>
            </div>
          </Modal>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Result
        status="404"
        title="Room Not Found"
        subTitle="The stream room you are looking for does not exist."
        extra={
          <Button type="primary" onClick={() => router.push('/admin/rooms')}>
            Back to Rooms
          </Button>
        }
      />
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="Error"
        subTitle={error}
        extra={
          <Space>
            <Button onClick={fetchRoom}>Retry</Button>
            <Button type="primary" onClick={() => router.push('/admin/rooms')}>
              Back to Rooms
            </Button>
          </Space>
        }
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space align="center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/admin/rooms')}
          />
          <Title level={4} style={{ margin: 0 }}>
            {room?.name || 'Room'}
          </Title>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        items={tabItems}
        onChange={handleTabChange}
      />
    </div>
  );
}

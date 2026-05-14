'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Radio,
  Space,
  Typography,
  Alert,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import { StreamRoomVisibility } from '@/types';
import type { StreamRoomDTO } from '@/types';

const { Title } = Typography;
const { Search } = Input;

function maskStreamKey(key: string): string {
  if (key.length <= 8) return key;
  return key.slice(0, 8) + '...';
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminRoomsPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState<StreamRoomDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/rooms?pageSize=100');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to load rooms');
        return;
      }
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleManualModeToggle = useCallback(
    async (id: string, checked: boolean) => {
      try {
        const res = await fetch(`/api/admin/rooms/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manualMode: checked }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          message.error(data.error || 'Failed to update room');
          return;
        }
        setRooms((prev) =>
          prev.map((r) => (r.id === id ? { ...r, manualMode: checked } : r))
        );
        message.success('Room updated');
      } catch {
        message.error('Failed to connect to server');
      }
    },
    []
  );

  const handleCreateRoom = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setCreateLoading(true);

      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          visibility: values.visibility,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        message.error(data.error || 'Failed to create room');
        return;
      }

      const data = await res.json();
      setRooms((prev) => [data.room, ...prev]);
      message.success('Room created');
      setCreateModalOpen(false);
      form.resetFields();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return; // form validation error, no action needed
      }
      message.error('Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  }, [form]);

  const handleDeleteRoom = useCallback(
    (room: StreamRoomDTO) => {
      Modal.confirm({
        title: `Delete "${room.name}"?`,
        content:
          'This action cannot be undone. All associated stream keys and play sources for this room will also be deleted.',
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            const res = await fetch(`/api/admin/rooms/${room.id}`, {
              method: 'DELETE',
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              message.error(data.error || 'Failed to delete room');
              return;
            }
            setRooms((prev) => prev.filter((r) => r.id !== room.id));
            message.success('Room deleted');
          } catch {
            message.error('Failed to connect to server');
          }
        },
      });
    },
    []
  );

  const filteredRooms = searchText
    ? rooms.filter((r) =>
        r.name.toLowerCase().includes(searchText.toLowerCase())
      )
    : rooms;

  const columns: ColumnsType<StreamRoomDTO> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: StreamRoomDTO) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => router.push(`/admin/rooms/${record.id}`)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      responsive: ['md'],
    },
    {
      title: 'Visibility',
      dataIndex: 'visibility',
      key: 'visibility',
      render: (visibility: StreamRoomVisibility) => (
        <Tag color={visibility === StreamRoomVisibility.PUBLIC ? 'green' : 'red'}>
          {visibility}
        </Tag>
      ),
    },
    {
      title: 'Stream Key',
      dataIndex: 'streamKey',
      key: 'streamKey',
      render: (key: string) => (
        <code style={{ fontSize: 12 }}>{maskStreamKey(key)}</code>
      ),
    },
    {
      title: 'Manual Mode',
      dataIndex: 'manualMode',
      key: 'manualMode',
      render: (manualMode: boolean, record: StreamRoomDTO) => (
        <Switch
          checked={manualMode}
          onChange={(checked) => handleManualModeToggle(record.id, checked)}
        />
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend',
      render: (date: string) => formatDate(date),
      responsive: ['lg'],
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: StreamRoomDTO) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => router.push(`/admin/rooms/${record.id}`)}
          />
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleDeleteRoom(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
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
        <Title level={4} style={{ margin: 0 }}>
          Rooms
        </Title>
        <Space>
          <Search
            placeholder="Search rooms..."
            allowClear
            style={{ width: 220 }}
            onSearch={setSearchText}
            onChange={(e) => {
              if (!e.target.value) setSearchText('');
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Room
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={fetchRooms}>
              Retry
            </Button>
          }
        />
      )}

      <Table
        columns={columns}
        dataSource={filteredRooms}
        rowKey="id"
        loading={loading}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `${total} rooms`,
        }}
      />

      <Modal
        title="Create Room"
        open={createModalOpen}
        onOk={handleCreateRoom}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createLoading}
        okText="Create"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ visibility: StreamRoomVisibility.PUBLIC }}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a room name' }]}
          >
            <Input placeholder="Enter room name" />
          </Form.Item>

          <Form.Item name="slug" label="Slug">
            <Input
              placeholder="Auto-generated from name"
              disabled
              value={
                form.getFieldValue('name')
                  ? form
                      .getFieldValue('name')
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')
                  : ''
              }
            />
          </Form.Item>

          <Form.Item name="visibility" label="Visibility">
            <Radio.Group>
              <Radio value={StreamRoomVisibility.PUBLIC}>Public</Radio>
              <Radio value={StreamRoomVisibility.PRIVATE}>Private</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

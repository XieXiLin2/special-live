import { setTestEnv, createMockRoom, createRequest, parseJson } from '../helpers';
setTestEnv();

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as adminRoomsGet, POST as adminRoomsPost } from '@/app/api/admin/rooms/route';
import { GET as publicRoomsGet } from '@/app/api/rooms/route';
import { GET as adminRoomGet, PATCH as adminRoomPatch, DELETE as adminRoomDelete } from '@/app/api/admin/rooms/[id]/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    streamRoom: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/guards', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', role: 'ADMIN' }),
}));

vi.mock('@/lib/stream-key', () => ({
  generateStreamKey: vi.fn().mockReturnValue('mock-stream-key-xyz'),
}));

describe('Room Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a public room', async () => {
    const mockRoom = createMockRoom({ id: 'new-room-id', name: 'Test Room', slug: 'test-room' });
    vi.mocked(prisma.streamRoom.create).mockResolvedValue(mockRoom);

    const request = createRequest('http://localhost:3000/api/admin/rooms', {
      method: 'POST',
      body: { name: 'Test Room', visibility: 'PUBLIC' },
    });

    const response = await adminRoomsPost(request);
    const data = await parseJson(response);

    expect(response.status).toBe(201);
    expect(data.room.name).toBe('Test Room');
    expect(data.room.visibility).toBe('PUBLIC');
    expect(vi.mocked(prisma.streamRoom.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Room',
          visibility: 'PUBLIC',
          streamKey: 'mock-stream-key-xyz',
        }),
      })
    );
  });

  it('should reject room creation without a name', async () => {
    const request = createRequest('http://localhost:3000/api/admin/rooms', {
      method: 'POST',
      body: { visibility: 'PUBLIC' },
    });

    const response = await adminRoomsPost(request);
    const data = await parseJson(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe('Name is required');
  });

  it('should list public rooms', async () => {
    const mockRooms = [
      createMockRoom({ id: 'room-1', name: 'Room One', slug: 'room-one' }),
      createMockRoom({ id: 'room-2', name: 'Room Two', slug: 'room-two' }),
    ];
    vi.mocked(prisma.streamRoom.findMany).mockResolvedValue(mockRooms);
    vi.mocked(prisma.streamRoom.count).mockResolvedValue(2);

    const request = new Request('http://localhost:3000/api/rooms');
    const response = await publicRoomsGet(request);
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(Array.isArray(data.rooms)).toBe(true);
    expect(data.rooms).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
  });

  it('should list admin rooms with pagination', async () => {
    const mockRooms = [createMockRoom({ id: 'room-1', name: 'Admin Room' })];
    vi.mocked(prisma.streamRoom.findMany).mockResolvedValue(mockRooms);
    vi.mocked(prisma.streamRoom.count).mockResolvedValue(1);

    const request = new Request('http://localhost:3000/api/admin/rooms?page=1&pageSize=10');
    const response = await adminRoomsGet(request);
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.rooms).toHaveLength(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
  });

  it('should update room visibility', async () => {
    const existingRoom = createMockRoom({ id: 'room-to-update', visibility: 'PUBLIC' });
    const updatedRoom = createMockRoom({ id: 'room-to-update', visibility: 'PRIVATE', name: 'Updated Room', slug: 'updated-room' });

    vi.mocked(prisma.streamRoom.findUnique).mockResolvedValue(existingRoom);
    vi.mocked(prisma.streamRoom.update).mockResolvedValue(updatedRoom);

    const request = createRequest('http://localhost:3000/api/admin/rooms/room-to-update', {
      method: 'PATCH',
      body: { visibility: 'PRIVATE', name: 'Updated Room' },
    });

    const response = await adminRoomPatch(request, { params: Promise.resolve({ id: 'room-to-update' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.room.visibility).toBe('PRIVATE');
    expect(data.room.name).toBe('Updated Room');
  });

  it('should reject invalid visibility value', async () => {
    const existingRoom = createMockRoom({ id: 'room-to-update' });
    vi.mocked(prisma.streamRoom.findUnique).mockResolvedValue(existingRoom);

    const request = createRequest('http://localhost:3000/api/admin/rooms/room-to-update', {
      method: 'PATCH',
      body: { visibility: 'INVALID' },
    });

    const response = await adminRoomPatch(request, { params: Promise.resolve({ id: 'room-to-update' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid visibility');
  });

  it('should return 404 when updating non-existent room', async () => {
    vi.mocked(prisma.streamRoom.findUnique).mockResolvedValue(null);

    const request = createRequest('http://localhost:3000/api/admin/rooms/non-existent', {
      method: 'PATCH',
      body: { name: 'New Name' },
    });

    const response = await adminRoomPatch(request, { params: Promise.resolve({ id: 'non-existent' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('should delete a room', async () => {
    const existingRoom = createMockRoom({ id: 'room-to-delete' });
    vi.mocked(prisma.streamRoom.findUnique).mockResolvedValue(existingRoom);
    vi.mocked(prisma.streamRoom.delete).mockResolvedValue(existingRoom);

    const request = createRequest('http://localhost:3000/api/admin/rooms/room-to-delete', {
      method: 'DELETE',
    });

    const response = await adminRoomDelete(request, { params: Promise.resolve({ id: 'room-to-delete' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vi.mocked(prisma.streamRoom.delete)).toHaveBeenCalledWith({ where: { id: 'room-to-delete' } });
  });

  it('should return 404 when deleting non-existent room', async () => {
    vi.mocked(prisma.streamRoom.findUnique).mockResolvedValue(null);

    const request = createRequest('http://localhost:3000/api/admin/rooms/non-existent', {
      method: 'DELETE',
    });

    const response = await adminRoomDelete(request, { params: Promise.resolve({ id: 'non-existent' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('should get a single room by id', async () => {
    const mockRoom = createMockRoom({ id: 'room-1' });
    vi.mocked(prisma.streamRoom.findUnique).mockResolvedValue(mockRoom);

    const request = new Request('http://localhost:3000/api/admin/rooms/room-1');
    const response = await adminRoomGet(request, { params: Promise.resolve({ id: 'room-1' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.room.id).toBe('room-1');
  });
});

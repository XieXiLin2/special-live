export enum StreamRoomVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum StreamStatus {
  OFFLINE = 'offline',
  LIVE = 'live',
}

export interface StreamRoomDTO {
  id: string;
  name: string;
  slug: string;
  visibility: StreamRoomVisibility;
  streamKey: string;
  manualMode: boolean;
  status: StreamStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamKeyDTO {
  id: string;
  label: string;
  isActive: boolean;
  roomId: string;
  createdAt: Date;
  expiresAt: Date | null;
}

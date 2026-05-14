export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

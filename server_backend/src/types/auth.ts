import { UserRole } from './user';

export interface TokenPayload {
    userId: number;
    username: string;
    tokenId: string;
    role: UserRole;
}

export interface DeviceInfo {
    type: string;
    os: string;
    browser: string;
    name: string;
}

export interface TokenResponse {
    token: string;
    refreshToken: string;
    sessionId: string;
} 
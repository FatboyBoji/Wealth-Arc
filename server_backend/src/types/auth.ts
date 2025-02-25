import { CookieOptions } from 'express';
import { UserRole } from './user';

export interface TokenPayload {
    userId: number;
    username: string;
    tokenId: string;
    role: UserRole;
}

export interface DeviceInfo {
    type: string;
    name: string;
    browser: string;
    os: string;
    ip?: string;
}

export interface TokenResponse {
    token: string;
    refreshToken: string;
    sessionId: string;
    cookieConfig: CookieOptions;
} 
export interface UserSession {
    id: number;
    userId: number;
    tokenId: string;
    deviceInfo: string;
    lastActive: Date;
    createdAt: Date;
}

export interface DeviceInfo {
    userAgent?: string;
    ip?: string;
    timestamp: string;
} 
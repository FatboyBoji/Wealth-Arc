export interface DeviceInfo {
    type: string;
    browser: string;
    os: string;
    timestamp: string;
    screenSize: {
        width: number;
        height: number;
    };
}

export interface DeviceSession {
    id: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    os: string;
    lastActive: string;
    isCurrentSession: boolean;
}

export interface AuthContextType {
    isAuthenticated: boolean;
    currentSession: {
        userId: number;
        tokenId: string;
    } | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<void>;
    terminateSession: (sessionId: string) => Promise<void>;
} 
export interface DeviceSession {
    id: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    os: string;
    lastActive: string;
    isCurrentSession: boolean;
}

export interface SessionState {
    activeSessions: DeviceSession[];
    isLoading: boolean;
    error: string | null;
    currentSessionId: string | null;
}

export interface MaxSessionsError extends Error {
    sessions: DeviceSession[];
    userId: number;
    message: string;
} 
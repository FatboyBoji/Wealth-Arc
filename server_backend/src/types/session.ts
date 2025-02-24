import { Request } from 'express';

export interface DeviceSession {
    id: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    os: string;
    lastActive: string;
    isCurrentSession: boolean;
}

export interface DeviceInfo {
    type: string;
    browser: string;
    os: string;
    timestamp: string;
    screenSize?: {
        width: number;
        height: number;
    };
}

export interface PreLoginTerminationRequest {
    userId: number;
    sessionId: string;
    deviceInfo: DeviceInfo;
}

export interface PreLoginTerminationResponse {
    success: boolean;
    message: string;
    sessionId: string;
    remainingSessions?: number;
    error?: SessionErrorCode;
}

export interface SessionState {
    activeSessions: DeviceSession[];
    isLoading: boolean;
    error: string | null;
    currentSessionId: string | null;
}

// Error codes
export const SESSION_ERROR_CODES = {
    INVALID_SESSION: 'INVALID_SESSION',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR'
} as const;

export type SessionErrorCode = typeof SESSION_ERROR_CODES[keyof typeof SESSION_ERROR_CODES];

// Backend-specific types
export interface SessionTerminationRequest extends Request {
    body: PreLoginTerminationRequest;
}

export class SessionTerminationError extends Error {
    constructor(
        message: string,
        public code: SessionErrorCode,
        public statusCode: number = 400,
        public details?: any
    ) {
        super(message);
        this.name = 'SessionTerminationError';
    }
}

export interface UserSession {
    id: string;
    user_id: number;
    token_id: string;
    device_type: string;
    device_os: string;
    device_browser: string;
    friendly_name: string;
    last_active: Date;
    created_at: Date;
    is_marked_for_deletion?: boolean;
    marked_at?: Date;
    marked_by_session_id?: string;
}
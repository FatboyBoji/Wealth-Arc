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

// #########################################################

import { Request } from 'express';

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

export interface UserSession {
    id: string;
    userId: number;
    tokenId: string;
    deviceType: string;
    deviceOs: string;
    deviceBrowser: string;
    friendlyName: string;
    lastActive: Date;
    createdAt: Date;
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
    error?: SessionErrorCode;
}

// Custom error types
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

// Express request type with our custom properties
export interface SessionTerminationRequest extends Request {
    body: PreLoginTerminationRequest;
}

// Error codes
export const SESSION_ERROR_CODES = {
    INVALID_SESSION: 'INVALID_SESSION',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR'
} as const;

// Type for session error codes
export type SessionErrorCode = typeof SESSION_ERROR_CODES[keyof typeof SESSION_ERROR_CODES]; 

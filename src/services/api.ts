import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig, AxiosError, AxiosInstance } from 'axios';
import { getDeviceInfo, getDeviceFriendlyName } from '../utils/deviceInfo';
import { DeviceInfo } from '../types/sessions';
import { logToFile } from '@/utils/logger';

// Move interfaces to the top and export them
export interface DeviceSession {
    id: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    os: string;
    lastActive: string;
    isCurrentSession: boolean;
}

export interface SessionResponse {
    success: boolean;
    sessions: DeviceSession[];
    currentSessionId: string;
}

// Existing interfaces
export interface LoginCredentials {
    username: string;
    password: string;
}

export interface User {
    id: number;
    username: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export type NewsType = 'neuigkeiten' | 'releases' | 'frameworks' | 'ankündigungen';

export interface NewsUpdate {
    id?: number;
    title: string;
    content: string;
    type: NewsType;
    version?: string;
    published_at?: string | Date;
    updated_at?: string | Date;
}

// Domain Configuration
const getDomainConfig = () => {
    if (typeof window === 'undefined') return null;
    
    const hostname = window.location.hostname;
    const isFactory = hostname.includes('sesa-factory.eu');
    const isIP = hostname.includes('178.254.26.117');
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        return {
            apiBase: 'http://localhost:3001/api',
            mainDomain: 'http://localhost:3000'
        };
    }

    if (isFactory) {
        return {
            apiBase: 'http://www.sesa-factory.eu:45600/api',
            mainDomain: 'http://www.sesa-factory.eu:45678'
        };
    }

    if (isIP) {
        return {
            apiBase: 'http://178.254.26.117:45600/api',
            mainDomain: 'http://178.254.26.117:45678'
        };
    }

    // Default fallback
    return {
        apiBase: 'http://178.254.26.117:45600/api',
        mainDomain: 'http://178.254.26.117:45678'
    };
};

// API Configuration
const domainConfig = getDomainConfig();
const API_BASE_URL = domainConfig?.apiBase || 'http://178.254.26.117:45600/api';

// Create axios instance with default config
export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

// Simplified CSRF token management
let csrfToken: string | null = null;

const getCsrfToken = async (): Promise<string> => {
    if (csrfToken) return csrfToken;

    try {
        const response = await api.get<{ csrfToken: string }>('/csrf-token');
        csrfToken = response.data.csrfToken;
        return csrfToken;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return '';
    }
};

// Request interceptor with domain-aware configuration
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Keep the original ApiError interface
export interface ApiError extends Error {
    response?: {
        data: {
            error: string;
            message?: string;
        };
        status: number;
    };
    config?: any;
}

// Create a class that implements the interface
export class ApiErrorImpl extends Error implements ApiError {
    response?: ApiError['response'];
    config?: any;
    status?: number;

    constructor(message: string, status?: number, response?: ApiError['response']) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }
}

// Update the error handling in the interceptor
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data || { message: 'Unknown server error' };
            
            switch (status) {
                case 401:
                case 403:
                    authService.logout();
                    window.location.href = '/admin/login';
                    throw new ApiErrorImpl('Session expired. Please login again.', status);
                case 404:
                    throw new ApiErrorImpl(data.message || 'Resource not found', status);
                case 429:
                    throw new ApiErrorImpl(data.message || 'Too many attempts', status);
                case 500:
                    throw new ApiErrorImpl(data.message || 'Internal server error', status);
                default:
                    throw new ApiErrorImpl(
                        data.message || 'An unexpected error occurred',
                        status
                    );
            }
        } else if (error.request) {
            throw new ApiErrorImpl('No response received from server', 0);
        } else {
            throw new ApiErrorImpl(error.message, 0);
        }
    }
);

// Export the response type
export interface ApiResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
}

// Authentication Service
export const authService = {
    async getStoredCredentials(): Promise<LoginCredentials | null> {
        const stored = localStorage.getItem('pending_login');
        return stored ? JSON.parse(stored) : null;
    },

    async retryLogin(): Promise<{ token: string }> {
        try {
            const credentials = await this.getStoredCredentials();
            if (!credentials) {
                throw new Error('No stored credentials');
            }
            const response = await this.login(credentials);
            return { token: response.token };
        } catch (error) {
            console.error('Failed to retry login:', error);
            throw error;
        }
    },

    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            const deviceInfo = getDeviceInfo();
            // Store credentials for retry after session termination
            if (!localStorage.getItem('pending_login')) {
                localStorage.setItem('pending_login', JSON.stringify(credentials));
            }

            const response = await api.post<AuthResponse>('/auth/login', {
                ...credentials,
                deviceInfo
            });

            if (response.data.token) {
                localStorage.setItem('auth_token', response.data.token);
                localStorage.removeItem('pending_login'); // Clear pending login on success
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 400) {
                if (error.response.data?.error === 'MAX_SESSIONS_REACHED') {
                    throw new MaxSessionsError(
                        error.response.data.sessions,
                        error.response.data.userId,
                        error.response.data.message || 'Maximum sessions reached'
                    );
                }
            }
            throw error;
        }
    },

    async logout(): Promise<void> {
        try {
            // Get current token
            const token = localStorage.getItem('auth_token');
            if (!token) {
                return;
            }

            // Call logout endpoint with empty object instead of null
            await api.post('/auth/logout', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Clear all auth data
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
        } catch (error) {
            console.error('Logout failed:', error);
            // Still remove tokens even if API call fails
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            throw error;
        }
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('auth_token');
    },

    getToken(): string | null {
        return localStorage.getItem('token');
    },

    setToken(token: string): void {
        localStorage.setItem('token', token);
        api.defaults.headers.Authorization = `Bearer ${token}`;
    },

    removeToken(): void {
        localStorage.removeItem('token');
        delete api.defaults.headers.Authorization;
    },

    async verifyToken(token?: string): Promise<boolean> {
        try {
            const useToken = token || this.getToken();
            if (!useToken) return false;
            
            const response = await api.post('/auth/verify', { token: useToken });
            return response.data.valid;
        } catch (error) {
            return false;
        }
    },

    async getActiveSessions(): Promise<DeviceSession[]> {
        try {
            const response = await api.get<SessionResponse>('/auth/active-sessions');
            return response.data.sessions;
        } catch (error) {
            console.error('Failed to fetch active sessions:', error);
            throw new ApiErrorImpl('Failed to fetch active sessions');
        }
    },

    async terminateSession(sessionId: string, userId: number): Promise<void> {
        try {
            const response = await api.post('/sessions/terminate-pre-login', {
                userId,
                sessionId
            });

            if (!response.data.success) {
                throw new ApiErrorImpl(response.data.message || 'Failed to terminate session', 0);
            }

            // Wait for session cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return response.data;
        } catch (error) {
            console.error('Session termination failed:', error);
            throw error;
        }
    },

    async handleMaxSessions(error: any): Promise<void> {
        if (error.response?.status === 400 && 
            error.response.data?.error === 'MAX_SESSIONS_REACHED') {
            throw new MaxSessionsError(
                error.response.data.sessions,
                error.response.data.userId,
                error.response.data.message
            );
        }
        throw error;
    },

    async refreshToken(refreshToken: string): Promise<string> {
        try {
            const response = await api.post('/auth/refresh-token', { refreshToken });
            return response.data.token;
        } catch (error) {
            // If refresh fails, force logout
            this.logout();
            throw error;
        }
    }
};

// News Service
export const newsService = {
    async getAll(type?: NewsType): Promise<NewsUpdate[]> {
        const params = type ? { type } : undefined;
        const response = await api.get('/news', { params });
        return response.data.data;
    },

    async getById(id: number): Promise<NewsUpdate> {
        const response = await api.get(`/news/${id}`);
        return response.data.data;
    },

    async create(news: Omit<NewsUpdate, 'id' | 'published_at' | 'updated_at'>): Promise<NewsUpdate> {
        const token = await getCsrfToken();
        const response = await api.post('/news', news, {
            headers: { 'CSRF-Token': token }
        });
        return response.data.data;
    },

    async update(id: number, news: Partial<NewsUpdate>): Promise<NewsUpdate> {
        const token = await getCsrfToken();
        const response = await api.put(`/news/${id}`, news, {
            headers: { 'CSRF-Token': token }
        });
        return response.data.data;
    },

    async delete(id: number): Promise<void> {
        const token = await getCsrfToken();
        await api.delete(`/news/${id}`, {
            headers: { 'CSRF-Token': token }
        });
    }
};

// Keep the ApiError class but rename it to avoid conflict
export class ApiRequestError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiRequestError';
    }
}

// Add custom error class for max sessions
export class MaxSessionsError extends Error {
    constructor(
        public sessions: DeviceSession[],
        public userId: number,
        message: string
    ) {
        super(message);
        this.name = 'MaxSessionsError';
    }
} 
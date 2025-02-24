import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig, AxiosError } from 'axios';
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

export const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Simplified CSRF token management
let csrfToken: string | null = null;

const getCsrfToken = async (): Promise<string> => {
    if (csrfToken) return csrfToken;

    try {
        const response = await axiosInstance.get<{ csrfToken: string }>('/csrf-token');
        csrfToken = response.data.csrfToken;
        return csrfToken;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return '';
    }
};

// Request interceptor with domain-aware configuration
axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    // Add auth token if it exists
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Remove the manual setting of Origin and Referer headers
    // Let the browser handle these automatically
    return config;
});

// Modified response interceptor with better error handling
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data || { message: 'Unknown server error' };
            
            // Special handling for MAX_SESSIONS_REACHED
            if (status === 400 && data.error === 'MAX_SESSIONS_REACHED') {
                return Promise.reject(error); // Let the login handler deal with this
            }
            
            // Handle other errors...
            switch (status) {
                case 401:
                case 403:
                    authService.logout();
                    window.location.href = '/admin/login';
                    throw new ApiError('Session expired. Please login again.', status);
                case 404:
                    throw new ApiError(data.message || 'Resource not found', status);
                case 429:
                    throw new ApiError(data.message || 'Too many attempts', status);
                case 500:
                    throw new ApiError(data.message || 'Internal server error', status);
                default:
                    throw new ApiError(
                        data.message || 'An unexpected error occurred',
                        status
                    );
            }
        } else if (error.request) {
            console.error('Request Error:', {
                error: error.request,
                timestamp: new Date().toISOString()
            });
            throw new ApiError('No response received from server', 0);
        } else {
            console.error('Error:', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw new ApiError(error.message, 0);
        }
    }
);

// Authentication Service
export const authService = {
    async retryLogin(): Promise<void> {
        const pendingLogin = localStorage.getItem('pending_login');
        if (!pendingLogin) return;

        try {
            const credentials = JSON.parse(pendingLogin);
            // Add delay to ensure DB is updated
            await new Promise(resolve => setTimeout(resolve, 1500));
            await this.login(credentials);
            localStorage.removeItem('pending_login');
        } catch (error) {
            console.error('Failed to retry login:', error);
            if (error instanceof MaxSessionsError) {
                // If we still get max sessions, clear pending login
                localStorage.removeItem('pending_login');
            }
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

            const response = await axiosInstance.post<AuthResponse>('/auth/login', {
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
            await axiosInstance.post('/auth/logout', {}, {
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
        return localStorage.getItem('auth_token');
    },

    async verifyToken(): Promise<boolean> {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return false;

            const response = await axiosInstance.get('/auth/verify');
            return response.data.valid;
        } catch (error) {
            console.error('Token verification failed:', {
                error,
                timestamp: new Date().toISOString()
            });
            // Clear token if verification fails
            this.logout();
            return false;
        }
    },

    async getActiveSessions(): Promise<DeviceSession[]> {
        try {
            const response = await axiosInstance.get<SessionResponse>('/auth/active-sessions');
            return response.data.sessions;
        } catch (error) {
            console.error('Failed to fetch active sessions:', error);
            throw new ApiError('Failed to fetch active sessions');
        }
    },

    async terminateSession(sessionId: string, userId: number): Promise<void> {
        try {
            const response = await axiosInstance.post('/sessions/terminate-pre-login', {
                userId,
                sessionId
            });

            if (!response.data.success) {
                throw new Error(response.data.message || 'Failed to terminate session');
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
    }
};

// News Service
export const newsService = {
    async getAll(type?: NewsType): Promise<NewsUpdate[]> {
        const params = type ? { type } : undefined;
        const response = await axiosInstance.get('/news', { params });
        return response.data.data;
    },

    async getById(id: number): Promise<NewsUpdate> {
        const response = await axiosInstance.get(`/news/${id}`);
        return response.data.data;
    },

    async create(news: Omit<NewsUpdate, 'id' | 'published_at' | 'updated_at'>): Promise<NewsUpdate> {
        const token = await getCsrfToken();
        const response = await axiosInstance.post('/news', news, {
            headers: { 'CSRF-Token': token }
        });
        return response.data.data;
    },

    async update(id: number, news: Partial<NewsUpdate>): Promise<NewsUpdate> {
        const token = await getCsrfToken();
        const response = await axiosInstance.put(`/news/${id}`, news, {
            headers: { 'CSRF-Token': token }
        });
        return response.data.data;
    },

    async delete(id: number): Promise<void> {
        const token = await getCsrfToken();
        await axiosInstance.delete(`/news/${id}`, {
            headers: { 'CSRF-Token': token }
        });
    }
};

// Error handling
export class ApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
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
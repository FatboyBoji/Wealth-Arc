import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Types
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

const api = axios.create({
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
        const response = await api.get<{ csrfToken: string }>('/csrf-token');
        csrfToken = response.data.csrfToken;
        return csrfToken;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return '';
    }
};

// Request interceptor with domain-aware configuration
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    // Add auth token if it exists
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Add origin and referer headers for CORS
    const domainConfig = getDomainConfig();
    if (domainConfig) {
        config.headers.Origin = domainConfig.mainDomain;
        config.headers.Referer = domainConfig.mainDomain;
    }

    return config;
});

// Modified response interceptor with better error handling
api.interceptors.response.use(
    response => response,
    error => {
        if (error.message === 'Network Error') {
            console.error('CORS or Network Error:', error);
            // You might want to show a user-friendly message here
        } else if (error.response) {
            console.error('Response Error:', error.response.data);
            console.error('Status:', error.response.status);
        } else if (error.request) {
            console.error('Request Error:', error.request);
        } else {
            console.error('Error:', error.message);
        }

        if (error.response && error.response.status === 401) {
            localStorage.removeItem('auth_token');
        }

        return Promise.reject(error);
    }
);

// Authentication Service
export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await api.post('/auth/login', credentials);
        const { token, user } = response.data;
        localStorage.setItem('auth_token', token);
        return { token, user };
    },

    logout(): void {
        localStorage.removeItem('auth_token');
        csrfToken = null;
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('auth_token');
    },

    async verifyToken(): Promise<boolean> {
        try {
            await api.get('/auth/verify');
            return true;
        } catch (error) {
            return false;
        }
    },
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

export default api; 
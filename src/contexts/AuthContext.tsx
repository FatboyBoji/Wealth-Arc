'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErrorImpl } from '../services/api';
import { AxiosResponse } from 'axios';
import { getDeviceInfo } from '../utils/deviceInfo';

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | null>(null);

// Add useAuth hook
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentSession, setCurrentSession] = useState<AuthContextType['currentSession']>(null);
    const router = useRouter();

    // Setup axios interceptor for token expiration
    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: any) => {
                if (error?.response?.status === 401) {
                    if (error.response?.data?.error === 'Token expired') {
                        // Token expired - try to refresh
                        try {
                            await refreshToken();
                            if (error.config) {
                                return api.request(error.config);
                            }
                        } catch (refreshError) {
                            // Refresh failed - logout
                            await logout();
                            router.push('/admin/login');
                        }
                    } else {
                        // Other auth error - logout
                        await logout();
                        router.push('/admin/login');
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => api.interceptors.response.eject(interceptor);
    }, [router]);

    const login = async (username: string, password: string) => {
        try {
            const deviceInfo = await getDeviceInfo();
            
            const response = await api.post('/auth/login', {
                username,
                password,
                deviceInfoReceived: {
                    type: deviceInfo.type,
                    browser: deviceInfo.browser,
                    os: deviceInfo.os,
                    timestamp: new Date().toISOString(),
                    screenSize: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    }
                }
            });

            const { token } = response.data;
            
            // Set the token in axios headers
            api.defaults.headers.Authorization = `Bearer ${token}`;
            
            // Parse token to get session info
            const payload = JSON.parse(atob(token.split('.')[1]));
            setCurrentSession({
                userId: payload.userId,
                tokenId: payload.tokenId
            });
            
            setIsAuthenticated(true);
            
            // Store token
            localStorage.setItem('token', token);
            
            return response.data;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            delete api.defaults.headers.Authorization;
            setIsAuthenticated(false);
        }
    };

    const refreshToken = async () => {
        try {
            const response = await api.post('/auth/refresh');
            api.defaults.headers.Authorization = `Bearer ${response.data.token}`;
            return response.data;
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    };

    const terminateSession = async (sessionId: string) => {
        if (!currentSession?.userId) {
            throw new Error('No active session');
        }
        
        try {
            await api.post('/auth/terminate-session', {
                sessionId,
                userId: currentSession.userId
            });
        } catch (error) {
            console.error('Failed to terminate session:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            currentSession,
            login,
            logout,
            refreshToken,
            terminateSession
        }}>
            {children}
        </AuthContext.Provider>
    );
} 
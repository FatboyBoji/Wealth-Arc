'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    authService, 
    MaxSessionsError,
    DeviceSession,
    ApiError
} from '@/services/api';
import { DeviceSessionModal } from '@/components/DeviceSessionModal';
import { LoginForm } from '@/components/LoginForm';
import { logToFile } from '@/utils/logger';

interface LoginState {
    username: string;
    password: string;
}

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [activeSessions, setActiveSessions] = useState<DeviceSession[]>([]);
    const [pendingLogin, setPendingLogin] = useState<LoginState | null>(null);

    const handleLogin = async (username: string, password: string) => {
        await logToFile('LoginPage: Starting login attempt', { username });
        setError(null);
        setIsLoading(true);

        try {
            const response = await authService.login({ username, password });
            await logToFile('LoginPage: Login response received', { success: !!response.token });
            
            if (response.token) {
                await logToFile('LoginPage: Login successful, redirecting...');
                localStorage.setItem('auth_token', response.token);
                sessionStorage.removeItem('pendingLogin'); // Clean up
                router.push('/admin/dashboard');
            }
        } catch (error) {
            if (error instanceof MaxSessionsError) {
                await logToFile('LoginPage: Max sessions reached', { 
                    sessionCount: error.sessions.length,
                    userId: error.userId
                });
                
                // Store credentials for session termination
                sessionStorage.setItem('pendingLogin', JSON.stringify({
                    username,
                    password,
                    userId: error.userId
                }));
                
                setActiveSessions(error.sessions.map(session => ({
                    ...session,
                    isCurrentSession: false
                })));
                setShowSessionModal(true);
                setPendingLogin({ username, password });
            } else {
                const message = error instanceof ApiError ? error.message : 'Login failed';
                await logToFile('LoginPage: Login error', { error: message });
                setError(message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSessionTerminate = async (sessionId: string) => {
        await logToFile('LoginPage: Starting session termination', { sessionId });
        setIsLoading(true);
        
        try {
            const storedLogin = sessionStorage.getItem('pendingLogin');
            if (!storedLogin) {
                throw new Error('No pending login found');
            }

            const { username, password } = JSON.parse(storedLogin);
            
            await authService.terminateSession(sessionId);
            await logToFile('LoginPage: Session terminated successfully', { sessionId });
            
            // Retry login with stored credentials
            await handleLogin(username, password);
        } catch (error) {
            const errorMessage = 'Failed to terminate session. Please try again.';
            await logToFile('LoginPage: Session termination failed', { 
                sessionId, 
                error 
            });
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModalClose = () => {
        setShowSessionModal(false);
        setPendingLogin(null);
        setError(null);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <LoginForm 
                    onSubmit={handleLogin}
                    isLoading={isLoading}
                    error={error}
                />

                <DeviceSessionModal
                    open={showSessionModal}
                    onClose={handleModalClose}
                    sessions={activeSessions}
                    onTerminateSession={handleSessionTerminate}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
} 
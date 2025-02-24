'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    authService, 
    MaxSessionsError,
    DeviceSession,
    ApiError
} from '@/services/api';
import { DeviceSessionModal } from '@/components/admin/DeviceSessionModal';
import { LoginForm } from '@/components/admin/LoginForm';
import { logToFile } from '@/utils/logger';
import { Box, Container, Paper } from '@mui/material';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [activeSessions, setActiveSessions] = useState<DeviceSession[]>([]);
    const [pendingCredentials, setPendingCredentials] = useState<{
        username: string;
        password: string;
    } | null>(null);

    const handleLogin = async (username: string, password: string) => {
        try {
            setIsLoading(true);
            setError(null);
            
            await logToFile('Login attempt', { username });
            await authService.login({ username, password });
            
            router.push('/admin/dashboard');
        } catch (error) {
            if (error instanceof MaxSessionsError) {
                await logToFile('Max sessions reached', { 
                    username,
                    sessionCount: error.sessions.length 
                });
                setActiveSessions(error.sessions);
                setPendingCredentials({ username, password });
                setShowSessionModal(true);
            } else {
                const errorMessage = error instanceof ApiError 
                    ? error.message 
                    : 'Login failed. Please try again.';
                setError(errorMessage);
                await logToFile('Login failed', { error: errorMessage });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSessionTerminate = async (sessionId: string) => {
        if (!pendingCredentials) return;

        try {
            setIsLoading(true);
            await logToFile('Terminating session', { sessionId });
            
            // First terminate the session
            await authService.terminateSession(sessionId);
            
            // Then retry the login
            await authService.login(pendingCredentials);
            
            await logToFile('Session terminated and login successful', { sessionId });
            
            // Clean up and redirect
            setShowSessionModal(false);
            setPendingCredentials(null);
            router.push('/admin/dashboard');
        } catch (error) {
            const errorMessage = error instanceof Error 
                ? error.message 
                : 'Failed to terminate session';
            setError(errorMessage);
            await logToFile('Session termination failed', { 
                sessionId, 
                error: errorMessage 
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleModalClose = () => {
        setShowSessionModal(false);
        setPendingCredentials(null);
        setError(null);
    };

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 8
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        width: '100%',
                        borderRadius: 2
                    }}
                >
                    <LoginForm 
                        onSuccess={() => router.push('/admin/dashboard')}
                    />

                    <DeviceSessionModal
                        open={showSessionModal}
                        onClose={handleModalClose}
                        sessions={activeSessions}
                        onTerminateSession={handleSessionTerminate}
                        isLoading={isLoading}
                    />
                </Paper>
            </Box>
        </Container>
    );
} 
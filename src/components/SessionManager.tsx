import React, { useState, useEffect } from 'react';
import { DeviceSessionModal } from './admin/DeviceSessionModal';
import { DeviceSession } from '@/types/sessions';
import { authService } from '@/services/api';
import { logToFile } from '@/utils/logger';
import { useAuth } from '../hooks/useAuth';
import { DeviceInfo } from '@/types/auth';

interface SessionManagerProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: DeviceSession[];
    userId: number;
    onSessionTerminated?: () => void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
    isOpen,
    onClose,
    sessions,
    userId,
    onSessionTerminated
}) => {
    const [isTerminating, setIsTerminating] = useState(false);
    const { login, currentSession } = useAuth();

    const handleTerminateSession = async (sessionId: string) => {
        try {
            setIsTerminating(true);
            await logToFile('Terminating session', { sessionId, userId });
            await authService.terminateSession(sessionId, userId);
            await logToFile('Session terminated successfully', { sessionId, userId });
            onSessionTerminated?.();
        } catch (error) {
            await logToFile('Failed to terminate session', { sessionId, userId, error });
            throw error;
        } finally {
            setIsTerminating(false);
        }
    };

    const handleSessionSwitch = async (oldSessionId: string) => {
        setIsTerminating(true);
        try {
            // Get current device info
            const deviceInfo: DeviceInfo = {
                type: 'browser',
                os: navigator.platform,
                browser: navigator.userAgent,
                name: `Browser on ${navigator.platform}`
            };

            // Immediately start new login
            const response = await fetch('/api/auth/pre-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToTerminate: {
                        id: oldSessionId,
                        userId: currentSession?.userId
                    },
                    deviceInfo
                })
            });

            if (!response.ok) {
                throw new Error('Failed to switch session');
            }

            const result = await response.json();
            
            // Update auth context with new session
            await login(result.token);

        } catch (error) {
            console.error('Session switch failed:', error);
            // Show error to user
        } finally {
            setIsTerminating(false);
        }
    };

    return (
        <DeviceSessionModal
            open={isOpen}
            onClose={onClose}
            sessions={sessions}
            onTerminateSession={handleTerminateSession}
            isLoading={isTerminating}
            isLoginAttempt={true}
        />
    );
}; 
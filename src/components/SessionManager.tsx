import React, { useState, useEffect } from 'react';
import { DeviceSessionModal } from './admin/DeviceSessionModal';
import { DeviceSession } from '@/types/sessions';
import { authService } from '@/services/api';
import { logToFile } from '@/utils/logger';
import { useAuth } from '../hooks/useAuth';
import { DeviceInfo } from '@/types/auth';
import { Logger } from '../../server_backend/src/services/logger';

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

    const handleSessionSwitch = async (oldSessionId: string, retryCount = 0) => {
        setIsTerminating(true);
        try {
            // First ensure session is terminated
            await authService.terminateSession(oldSessionId, userId);
            
            // Wait briefly to ensure DB consistency
            await new Promise(r => setTimeout(r, 500));
            
            const deviceInfo: DeviceInfo = {
                type: 'browser',
                os: navigator.platform,
                browser: navigator.userAgent,
                name: `Browser on ${navigator.platform}`
            };

            // Then try to get new session
            const response = await fetch('/api/auth/pre-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldSessionId,
                    userId: currentSession?.userId,
                    deviceInfo
                })
            });

            if (!response.ok) {
                const { token } = await authService.retryLogin();
                await login(token);
            } else {
                const { token } = await response.json();
                await login(token);
            }
            
            onSessionTerminated?.();
        } catch (error) {
            Logger.error('Session switch failed:', error);
            if (retryCount < 2) {
                await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
                return handleSessionSwitch(oldSessionId, retryCount + 1);
            }
            throw error; // Let error boundary handle it
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
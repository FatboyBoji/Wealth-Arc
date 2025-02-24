import React, { useState, useEffect } from 'react';
import { DeviceSessionModal } from './DeviceSessionModal';
import { DeviceSession } from '@/types/sessions';
import { authService } from '@/services/api';
import { logToFile } from '@/utils/logger';

interface SessionManagerProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: DeviceSession[];
    onSessionTerminated?: () => void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
    isOpen,
    onClose,
    sessions,
    onSessionTerminated
}) => {
    const [isTerminating, setIsTerminating] = useState(false);

    const handleTerminateSession = async (sessionId: string) => {
        try {
            setIsTerminating(true);
            await logToFile('Terminating session', { sessionId });
            await authService.terminateSession(sessionId);
            await logToFile('Session terminated successfully', { sessionId });
            onSessionTerminated?.();
        } catch (error) {
            await logToFile('Failed to terminate session', { sessionId, error });
            throw error;
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
        />
    );
}; 
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DeviceSession } from '@/types/auth';

interface SessionManagerProps {
    sessions: DeviceSession[];
    onSessionTerminated?: () => void;
}

export const SessionManager = ({
    sessions,
    onSessionTerminated
}: SessionManagerProps) => {
    const [isTerminating, setIsTerminating] = useState(false);
    const { terminateSession, currentSession } = useAuth();

    const handleTerminateSession = async (sessionId: string) => {
        try {
            setIsTerminating(true);
            await terminateSession(sessionId);
            onSessionTerminated?.();
        } catch (error) {
            console.error('Failed to terminate session:', error);
        } finally {
            setIsTerminating(false);
        }
    };

    return (
        <div className="space-y-4">
            {sessions.map(session => (
                <div
                    key={session.id}
                    className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
                >
                    <div>
                        <p className="font-medium">
                            {session.deviceName}
                            {session.id === currentSession?.tokenId && " (Current)"}
                        </p>
                        <p className="text-sm text-gray-500">
                            {session.browser} on {session.os}
                        </p>
                    </div>
                    
                    {session.id !== currentSession?.tokenId && (
                        <button
                            onClick={() => handleTerminateSession(session.id)}
                            disabled={isTerminating}
                            className="px-4 py-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                            {isTerminating ? 'Terminating...' : 'Terminate'}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}; 
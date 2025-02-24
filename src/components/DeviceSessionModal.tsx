import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Stack,
    Paper,
    CircularProgress
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { logToFile } from '@/utils/logger';

interface Session {
    id: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    os: string;
    lastActive: string;
    isCurrentSession: boolean;
}

interface DeviceSessionModalProps {
    open: boolean;
    onClose: () => void;
    sessions: Session[];
    onTerminateSession: (sessionId: string) => Promise<void>;
    isLoading?: boolean;
}

export const DeviceSessionModal: React.FC<DeviceSessionModalProps> = ({
    open,
    onClose,
    sessions,
    onTerminateSession,
    isLoading
}) => {
    const [terminatingSession, setTerminatingSession] = useState<string | null>(null);

    const handleTerminate = async (sessionId: string) => {
        await logToFile('DeviceSessionModal: Terminate button clicked', { sessionId });
        
        if (terminatingSession) return;
        
        setTerminatingSession(sessionId);
        try {
            await logToFile('DeviceSessionModal: Calling onTerminateSession', { sessionId });
            await onTerminateSession(sessionId);
            await logToFile('DeviceSessionModal: Session termination completed', { sessionId });
        } catch (error) {
            await logToFile('DeviceSessionModal: Failed to terminate session', { sessionId, error });
            console.error('Failed to terminate session:', error);
        } finally {
            setTerminatingSession(null);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={!terminatingSession ? onClose : undefined}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                Maximum Sessions Reached
            </DialogTitle>
            <DialogContent>
                <Typography gutterBottom>
                    Please select a session to terminate:
                </Typography>
                <Stack spacing={2} mt={2}>
                    {sessions.map((session) => (
                        <Paper
                            key={session.id}
                            elevation={1}
                            sx={{
                                p: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1
                            }}
                        >
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center' 
                            }}>
                                <Typography variant="subtitle1">
                                    {session.deviceName}
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    disabled={session.isCurrentSession || terminatingSession === session.id}
                                    onClick={() => handleTerminate(session.id)}
                                    sx={{ minWidth: 100 }}
                                >
                                    {terminatingSession === session.id ? (
                                        <CircularProgress size={20} color="inherit" />
                                    ) : (
                                        'TERMINATE'
                                    )}
                                </Button>
                            </div>
                            <Typography variant="body2" color="text.secondary">
                                Last active: {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {session.deviceType} • {session.browser} • {session.os}
                            </Typography>
                        </Paper>
                    ))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button 
                    onClick={onClose}
                    disabled={!!terminatingSession}
                >
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}; 
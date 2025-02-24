import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Typography,
    CircularProgress,
    Box,
    Alert
} from '@mui/material';
import { DeviceSession } from '@/types/sessions';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import DeleteIcon from '@mui/icons-material/Delete';
import ComputerIcon from '@mui/icons-material/Computer';
import PhoneIcon from '@mui/icons-material/Phone';
import TabletIcon from '@mui/icons-material/Tablet';
import { logToFile } from '@/utils/logger';
import { authService } from '@/services/api';
import { MaxSessionsError } from '@/types/errors';

interface DeviceSessionModalProps {
    open: boolean;
    onClose: () => void;
    sessions: DeviceSession[];
    isLoading?: boolean;
    currentSessionId?: string;
    isLoginAttempt?: boolean;
    onTerminateSession?: (sessionId: string) => Promise<void>;
}

export const DeviceSessionModal = ({
    open,
    onClose,
    sessions,
    isLoading = false,
    currentSessionId,
    isLoginAttempt = true,
    onTerminateSession
}: DeviceSessionModalProps) => {
    const [terminatingId, setTerminatingId] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const handleTerminate = async (sessionId: string) => {
        if (terminatingId) return;
        
        setTerminatingId(sessionId);
        setError(null);
        
        try {
            await logToFile('Session termination initiated', { 
                sessionId,
                isLoginAttempt 
            });

            if (onTerminateSession) {
                await onTerminateSession(sessionId);
                
                // Wait for session to be fully terminated
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                await logToFile('Session termination completed', {
                    sessionId,
                    isLoginAttempt
                });
                
                if (isLoginAttempt) {
                    try {
                        await authService.retryLogin();
                        onClose();
                    } catch (retryError) {
                        if (retryError instanceof MaxSessionsError) {
                            // Update the sessions list instead of closing
                            setError('Session terminated, but maximum sessions still reached. Please terminate another session.');
                            if (onTerminateSession) {
                                // Refresh sessions list
                                await onTerminateSession(sessionId);
                            }
                        } else {
                            throw retryError;
                        }
                    }
                } else {
                    onClose();
                }
            }
        } catch (error) {
            await logToFile('Session termination error', {
                sessionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            setError(error instanceof Error ? error.message : 'Failed to terminate session');
        } finally {
            setTerminatingId(null);
        }
    };

    const getDeviceIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'mobile':
                return <PhoneIcon />;
            case 'tablet':
                return <TabletIcon />;
            default:
                return <ComputerIcon />;
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                {isLoginAttempt ? 'Maximum Sessions Reached' : 'Active Device Sessions'}
            </DialogTitle>

            {isLoginAttempt && (
                <Alert severity="info" sx={{ mx: 3, mt: 1 }}>
                    You have reached the maximum number of active sessions. 
                    Please terminate one of your existing sessions to continue logging in.
                </Alert>
            )}

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                {isLoading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <List>
                        {sessions.map((session) => (
                            <ListItem 
                                key={session.id}
                                sx={{
                                    bgcolor: session.id === currentSessionId ? 'action.selected' : 'transparent',
                                    borderRadius: 1,
                                    mb: 1
                                }}
                            >
                                <Box sx={{ mr: 2 }}>
                                    {getDeviceIcon(session.deviceType)}
                                </Box>
                                <ListItemText
                                    primary={
                                        <Typography>
                                            {session.deviceName}
                                            {session.id === currentSessionId && (
                                                <Typography 
                                                    component="span" 
                                                    color="primary"
                                                    sx={{ ml: 1, fontSize: '0.9em' }}
                                                >
                                                    (Current session)
                                                </Typography>
                                            )}
                                        </Typography>
                                    }
                                    secondary={
                                        <>
                                            <Typography component="span" variant="body2" color="text.primary">
                                                {session.browser} on {session.os}
                                            </Typography>
                                            <br />
                                            Last active: {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                                        </>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    {session.id !== currentSessionId && (
                                        <IconButton 
                                            edge="end" 
                                            onClick={() => handleTerminate(session.id)}
                                            disabled={isLoading || !!terminatingId}
                                            color={isLoginAttempt ? "primary" : "default"}
                                        >
                                            {terminatingId === session.id ? (
                                                <CircularProgress size={24} />
                                            ) : (
                                                <DeleteIcon />
                                            )}
                                        </IconButton>
                                    )}
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                {isLoginAttempt ? (
                    <Button onClick={onClose} color="primary">
                        Cancel Login
                    </Button>
                ) : (
                    <Button onClick={onClose} color="primary">
                        Close
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}; 
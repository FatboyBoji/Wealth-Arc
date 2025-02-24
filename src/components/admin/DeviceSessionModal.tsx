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

interface DeviceSessionModalProps {
    open: boolean;
    onClose: () => void;
    sessions: DeviceSession[];
    onTerminateSession: (sessionId: string) => Promise<void>;
    isLoading?: boolean;
    currentSessionId?: string;
    isLoginAttempt?: boolean;
}

export const DeviceSessionModal: React.FC<DeviceSessionModalProps> = ({
    open,
    onClose,
    sessions,
    onTerminateSession,
    isLoading,
    currentSessionId,
    isLoginAttempt = false
}) => {
    const [terminatingId, setTerminatingId] = React.useState<string | null>(null);

    const handleTerminate = async (sessionId: string) => {
        try {
            setTerminatingId(sessionId);
            await onTerminateSession(sessionId);
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
                                            disabled={!!terminatingId}
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
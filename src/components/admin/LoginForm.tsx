import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, MaxSessionsError } from '@/services/api';
import { DeviceSessionModal } from './DeviceSessionModal';
import { DeviceSession } from '@/types/sessions';
import { logToFile } from '@/utils/logger';
import {
    TextField,
    Button,
    Alert,
    Box,
    Typography,
    CircularProgress,
    Fade
} from '@mui/material';

interface ValidationErrors {
    username?: string;
    password?: string;
}

interface LoginFormProps {
    onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Session management state
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [sessions, setSessions] = useState<DeviceSession[]>([]);
    const [username, setUsername] = useState('');
    
    // Store credentials temporarily for retry after session termination
    const [pendingUserId, setPendingUserId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState({
        username: false,
        password: false
    });

    // Add new states for smooth transitions
    const [loginState, setLoginState] = useState<'idle' | 'attempting' | 'retrying'>('idle');

    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'username':
                if (!value) return 'Username is required';
                if (value.length < 3) return 'Username must be at least 3 characters';
                if (value.length > 50) return 'Username must be less than 50 characters';
                if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers and underscore';
                return '';
            case 'password':
                if (!value) return 'Password is required';
                if (value.length < 8) return 'Password must be at least 8 characters';
                if (value.length > 100) return 'Password must be less than 100 characters';
                return '';
            default:
                return '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (touched[name as keyof typeof touched]) {
            setErrors(prev => ({
                ...prev,
                [name]: validateField(name, value)
            }));
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        setErrors(prev => ({
            ...prev,
            [name]: validateField(name, value)
        }));
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {
            username: validateField('username', formData.username),
            password: validateField('password', formData.password)
        };
        setErrors(newErrors);
        return !Object.values(newErrors).some(error => error);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await authService.login(formData);
            
            await logToFile('Login successful', { username: formData.username });
            
            // Make sure we call onSuccess after successful login
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            if (error instanceof MaxSessionsError) {
                setSessions(error.sessions);
                setPendingUserId(error.userId);
                setShowSessionModal(true);
            } else {
                setError(error instanceof Error ? error.message : 'Login failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSessionTerminate = async (sessionId: string) => {
        if (!pendingUserId) return;

        try {
            setIsLoading(true);
            setLoginState('retrying');
            
            // First terminate the session
            await authService.terminateSession(sessionId, pendingUserId);
            
            // Wait for the session to be fully terminated
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Retry login with stored credentials
            await authService.login(formData);
            
            // Close modal and redirect
            setShowSessionModal(false);
            setPendingUserId(null);
            onSuccess?.();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to terminate session');
            setLoginState('idle');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box className="max-w-md w-full mx-auto">
            <Typography variant="h4" component="h1" align="center" gutterBottom>
                Admin Login
            </Typography>
            
            <Typography variant="body1" align="center" color="textSecondary" paragraph>
                Sign in to access the admin dashboard
            </Typography>

            {error && (
                <Alert severity="error" className="mb-4">
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <TextField
                    fullWidth
                    required
                    id="username"
                    name="username"
                    label="Username"
                    value={formData.username}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.username && !!errors.username}
                    helperText={touched.username && errors.username}
                    variant="outlined"
                    disabled={isLoading}
                    autoComplete="username"
                />

                <TextField
                    fullWidth
                    required
                    id="password"
                    name="password"
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.password && !!errors.password}
                    helperText={touched.password && errors.password}
                    variant="outlined"
                    disabled={isLoading}
                    autoComplete="current-password"
                />

                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : null}
                >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
            </form>

            <DeviceSessionModal
                open={showSessionModal}
                onClose={() => setShowSessionModal(false)}
                sessions={sessions}
                onTerminateSession={handleSessionTerminate}
                isLoading={isLoading}
                isLoginAttempt={true}
            />

            <Fade
                in={loginState === 'retrying'}
                timeout={300}
            >
                <Box 
                    position="fixed"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bgcolor="rgba(255, 255, 255, 0.8)"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    zIndex={1400}
                >
                    <Box textAlign="center">
                        <CircularProgress />
                        <Typography variant="h6" sx={{ mt: 2 }}>
                            Signing you in...
                        </Typography>
                    </Box>
                </Box>
            </Fade>
        </Box>
    );
}; 
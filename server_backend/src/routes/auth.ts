import { Router } from 'express';
import { body } from 'express-validator';
import { login, register, getActiveSessions, terminateSession, refreshToken, handleLogout } from '../controllers/auth';
import { validate, ValidationRules } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../config/database';
import { authenticateUser } from '../services/auth';
import { TokenService } from '../config/auth';
import { Request, Response } from 'express';
import { MaxSessionsError } from '../config/auth';
import { PasswordPolicyService } from '../services/passwordPolicy';

// Add these interfaces
interface AuthResult {
    success: boolean;
    token?: string;
    user?: {
        id: number;
        username: string;
    };
    message?: string;
}

interface AuthError extends Error {
    code?: string;
    status?: number;
}

const router = Router();

// Registration validation
const registerValidation = [
    ValidationRules.username(),
    ValidationRules.email(),
    ValidationRules.password(),
    ValidationRules.firstName(),
    ValidationRules.lastName()
];

// Login validation
const loginValidation = [
    ValidationRules.username(),
    ValidationRules.password(),
    ValidationRules.deviceInfo()
];

// Refresh token validation
const refreshTokenValidation = [
    body('refreshToken')
        .notEmpty().withMessage('Refresh token is required')
];

// Routes
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password, deviceInfo } = req.body;
        
        if (!username || !password) {
            res.status(400).json({ error: 'Missing credentials' });
            return;
        }

        try {
            const result = await authenticateUser(username, password, deviceInfo);
            if (result.success) {
                res.json(result);
            } else {
                res.status(401).json(result);
            }
        } catch (error) {
            if (error instanceof MaxSessionsError) {
                // Format sessions for frontend
                const formattedSessions = error.sessions.map(session => ({
                    id: session.id,
                    deviceName: session.friendly_name,
                    deviceType: session.device_type,
                    browser: session.device_browser,
                    os: session.device_os,
                    lastActive: session.last_active,
                    isCurrentSession: session.is_current_session
                }));

                res.status(400).json({
                    error: 'MAX_SESSIONS_REACHED',
                    message: 'Maximum number of sessions reached',
                    sessions: formattedSessions
                });
                return;
            }
            throw error; // Re-throw other errors
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/register', 
    rateLimiter,
    validate(registerValidation), 
    register
);

router.get('/verify', authenticateToken, (req, res) => {
    try {
        // If we get here, the token is valid (authenticateToken middleware passed)
        res.json({ 
            valid: true,
            user: req.user // Include user info in response
        });
    } catch (error) {
        console.error('Token verification error:', {
            error,
            timestamp: new Date().toISOString()
        });
        res.status(401).json({ 
            valid: false,
            message: 'Invalid token'
        });
    }
});

router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const { query } = await import('../config/database');
        const result = await query(
            'SELECT id, device_info, last_active, created_at FROM user_sessions_wa WHERE user_id = $1',
            [req.user?.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

router.delete('/sessions/:tokenId', authenticateToken, async (req, res) => {
    try {
        await TokenService.invalidateSession(req.params.tokenId);
        res.json({ message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

router.post('/logout', authenticateToken, handleLogout);

router.get('/active-sessions', 
    authenticateToken, 
    getActiveSessions
);

router.delete('/terminate-session/:sessionId', 
    authenticateToken,
    terminateSession
);

router.post('/refresh-token',
    rateLimiter,
    validate(refreshTokenValidation),
    refreshToken
);

export default router; 
import { Router } from 'express';
import { body } from 'express-validator';
import { login, register } from '../controllers/auth';
import { validate, ValidationMessages } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../config/database';
import { authenticateUser } from '../services/auth';
import { TokenService } from '../config/auth';

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

// Validation rules
const loginValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Username'))
        .isLength({ min: 3 }).withMessage(ValidationMessages.minLength('Username', 3)),
    body('password')
        .notEmpty().withMessage(ValidationMessages.required('Password'))
];

const registerValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Username'))
        .isLength({ min: 3 }).withMessage(ValidationMessages.minLength('Username', 3))
        .isLength({ max: 50 }).withMessage(ValidationMessages.maxLength('Username', 50))
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .notEmpty().withMessage(ValidationMessages.required('Password'))
        .isLength({ min: 6 }).withMessage(ValidationMessages.minLength('Password', 6))
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
];

// Routes
router.post('/login', validate(loginValidation), async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Check rate limit before processing login
        rateLimiter.checkRateLimit(username);
        
        // Use the authentication service instead of the controller directly
        const authResult = await authenticateUser(username, password);
        
        if (authResult.success && authResult.token && authResult.user) {
            // Clear rate limit attempts on successful login
            rateLimiter.clearAttempts(username);
            res.json({ 
                token: authResult.token, 
                user: authResult.user 
            });
        } else {
            res.status(401).json({ 
                message: authResult.message || 'Invalid credentials' 
            });
        }
    } catch (error: unknown) {
        // Type guard for error handling
        if (error instanceof Error) {
            if (error.message.includes('Too many login attempts')) {
                res.status(429).json({ message: error.message });
            } else {
                console.error('Login error:', error);
                res.status(500).json({ 
                    message: 'Internal server error',
                    error: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        } else {
            res.status(500).json({ message: 'An unknown error occurred' });
        }
    }
});

router.post('/register', validate(registerValidation), register);

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

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        if (!req.user?.tokenId) {
            console.warn('Logout attempted without token ID:', {
                user: req.user,
                timestamp: new Date().toISOString()
            });
            res.status(400).json({ error: 'No active session' });
            return;
        }

        console.log('Starting logout process:', {
            userId: req.user.userId,
            tokenId: req.user.tokenId,
            timestamp: new Date().toISOString()
        });

        // First check if session exists
        const sessionExists = await TokenService.isSessionValid(req.user.tokenId);
        console.log('Session check before logout:', {
            exists: sessionExists,
            tokenId: req.user.tokenId,
            timestamp: new Date().toISOString()
        });

        // Attempt to remove session
        await TokenService.invalidateSession(req.user.tokenId);

        // Verify session was removed
        const sessionStillExists = await TokenService.isSessionValid(req.user.tokenId);
        console.log('Session check after logout:', {
            exists: sessionStillExists,
            tokenId: req.user.tokenId,
            timestamp: new Date().toISOString()
        });

        if (sessionStillExists) {
            console.error('Session persisted after logout attempt:', {
                tokenId: req.user.tokenId,
                timestamp: new Date().toISOString()
            });

            // Try one more time with direct query
            const { query } = await import('../config/database');
            const result = await query(
                'DELETE FROM user_sessions_wa WHERE token_id = $1',
                [req.user.tokenId]
            );

            console.log('Forced session deletion result:', {
                success: result?.rowCount ? result.rowCount > 0 : false,
                rowsAffected: result?.rowCount ?? 0,
                tokenId: req.user.tokenId,
                timestamp: new Date().toISOString()
            });
        }

        // Add after session invalidation attempt
        await TokenService.debugSessionState(req.user.tokenId);

        res.json({ 
            message: 'Logged out successfully',
            sessionCleanedUp: !sessionStillExists
        });

    } catch (error) {
        console.error('Logout error:', {
            error,
            userId: req.user?.userId,
            tokenId: req.user?.tokenId,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: 'Failed to logout' });
    }
});

export default router; 
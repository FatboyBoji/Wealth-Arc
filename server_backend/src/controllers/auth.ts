import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { TokenService, MaxSessionsError } from '../config/auth';
import { authenticateUser, logout } from '../services/auth';
import { Logger } from '../services/logger';
import { AuthError, ValidationError, AppError } from '../services/errors';
import { UserCreateInput, UserResponse, UserOfWA } from '../types/user';
import { DeviceInfo } from '../types/auth';
import { loginRateLimiter } from '../config/database';

// Helper function to format user response
const formatUserResponse = (user: UserOfWA): UserResponse => ({
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    is_active: user.is_active,
    is_email_verified: user.is_email_verified,
    last_login: user.last_login
});

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;
        const deviceInfo: DeviceInfo = {
            type: req.body.deviceType || 'unknown',
            os: req.body.deviceOs || 'unknown',
            browser: req.body.deviceBrowser || 'unknown',
            name: req.body.deviceName || 'Unknown Device'
        };

        try {
            // Check rate limiting
            loginRateLimiter.checkRateLimit(username);

            const user = await UserModel.findByUsername(username);
            
            if (!user || !user.is_active) {
                throw new AuthError('Invalid credentials', 401);
            }

            const isValid = await UserModel.verifyPassword(user, password);
            if (!isValid) {
                const attempts = await UserModel.incrementFailedLogin(user.id);
                throw new AuthError(`Invalid credentials. ${5 - attempts} attempts remaining.`, 401);
            }

            // Reset failed attempts and update last login
            await UserModel.updateLastLogin(user.id);

            // Generate tokens
            const { token, refreshToken } = await TokenService.generateTokens(user.id, deviceInfo);

            // Clear rate limiting on successful login
            loginRateLimiter.clearAttempts(username);

            res.json({
                user: formatUserResponse(user),
                token,
                refreshToken
            });

        } catch (error) {
            if (error instanceof AuthError) {
                throw error;
            }
            throw new AuthError('Authentication failed', 401);
        }

    } catch (error) {
        Logger.error('Login failed', error);
        
        if (error instanceof AppError) {
            res.status(error.status).json({ 
                error: error.code,
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'LOGIN_FAILED',
                message: 'Internal server error' 
            });
        }
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, email, password, first_name, last_name } = req.body;

        const userInput: UserCreateInput = {
            username,
            email,
            password,
            first_name,
            last_name,
            role: 'user' // Default role for new registrations
        };

        const user = await UserModel.create(userInput);
        
        // Generate token using TokenService
        const deviceInfo = {
            type: req.body.deviceType || 'unknown',
            os: req.body.deviceOs || 'unknown',
            browser: req.body.deviceBrowser || 'unknown',
            name: req.body.deviceName || 'Unknown Device'
        };

        const { token, refreshToken } = await TokenService.generateTokens(user.id, deviceInfo);

        res.status(201).json({
            user: formatUserResponse(user),
            token,
            refreshToken
        });

    } catch (error) {
        Logger.error('Registration failed', error);
        
        if (error instanceof ValidationError) {
            res.status(400).json({ 
                error: 'VALIDATION_ERROR',
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'REGISTRATION_FAILED',
                message: 'Failed to create user account' 
            });
        }
    }
};

// Add new controller function for active sessions
export const getActiveSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw new AuthError('User not authenticated', 401);
        }

        const sessions = await TokenService.getActiveSessions(userId);
        res.json({ sessions });

    } catch (error) {
        Logger.error('Failed to get active sessions', error);
        
        if (error instanceof AppError) {
            res.status(error.status).json({ 
                error: error.code,
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'INTERNAL_ERROR',
                message: 'Failed to retrieve sessions' 
            });
        }
    }
};

// Add terminate session controller
export const terminateSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            throw new AuthError('User not authenticated', 401);
        }

        await TokenService.terminateSession(userId, sessionId);
        res.json({ message: 'Session terminated successfully' });

    } catch (error) {
        Logger.error('Session termination failed', error);
        
        if (error instanceof AppError) {
            res.status(error.status).json({ 
                error: error.code,
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'INTERNAL_ERROR',
                message: 'Failed to terminate session' 
            });
        }
    }
};

// Add new controller method
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new ValidationError('Refresh token is required');
        }

        const result = await TokenService.refreshAccessToken(refreshToken);
        
        if (!result) {
            throw new AuthError('Invalid or expired refresh token', 401);
        }

        res.json({
            token: result.token,
            user: formatUserResponse(result.user)
        });
    } catch (error) {
        Logger.error('Token refresh failed', error);
        
        if (error instanceof AppError) {
            res.status(error.status).json({ 
                error: error.code,
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'INTERNAL_ERROR',
                message: 'Internal server error' 
            });
        }
    }
};

export const handleLogout = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const tokenId = req.user?.tokenId;

        if (!userId || !tokenId) {
            Logger.warn('Logout attempted without valid session', {
                user: req.user,
                path: req.path
            });
            res.status(401).json({ 
                error: 'UNAUTHORIZED',
                message: 'No valid session found' 
            });
            return;
        }

        // First verify the session exists
        const sessionExists = await TokenService.isSessionValid(tokenId);
        Logger.auth('Session verification for logout', {
            exists: sessionExists,
            userId,
            tokenId
        });

        // Perform logout (even if session doesn't exist, to clean up refresh tokens)
        await TokenService.logout(userId, tokenId);

        // Double check cleanup
        const [sessionStillExists, tokenStillValid] = await Promise.all([
            TokenService.isSessionValid(tokenId),
            TokenService.isRefreshTokenValid(tokenId)
        ]);

        if (sessionStillExists || tokenStillValid) {
            Logger.error('Cleanup verification failed', {
                userId,
                tokenId,
                sessionExists: sessionStillExists,
                tokenValid: tokenStillValid
            });
        }

        Logger.auth('Logout successful', {
            userId,
            tokenId,
            cleanupVerified: !sessionStillExists && !tokenStillValid
        });

        res.status(200).json({ 
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        Logger.error('Logout handler error', { error, userId: req.user?.userId });
        res.status(500).json({ 
            error: 'INTERNAL_ERROR',
            message: 'Failed to logout' 
        });
    }
}; 
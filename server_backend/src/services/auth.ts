import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { TokenService, MaxSessionsError, AUTH_CONFIG } from '../config/auth';
import { UserModel } from '../models/User';
import { DeviceInfo, TokenResponse } from '../types/auth';
import { Logger } from './logger';
import { AuthError } from '../services/errors';
import jwt from 'jsonwebtoken';
import { UserOfWA } from '@/types/user';

interface AuthResult {
    success: boolean;
    token?: string;
    refreshToken?: string;
    user?: {
        id: number;
        username: string;
    };
    message?: string;
    error?: string;
}

export async function authenticateUser(
    username: string, 
    password: string,
    deviceInfo: DeviceInfo
): Promise<AuthResult> {
    console.log('Auth attempt with raw body:', {
        username,
        deviceInfoReceived: deviceInfo
    });

    try {
        // Find user
        const user = await UserModel.findByUsername(username);
        
        if (!user) {
            return { success: false, message: 'Invalid credentials' };
        }

        // Verify password
        const isValid = await UserModel.verifyPassword(user, password);
        
        if (!isValid) {
            return { success: false, message: 'Invalid credentials' };
        }

        // Get active sessions count
        const activeSessionCount = await TokenService.getActiveSessions(user.id);
        
        if (activeSessionCount >= AUTH_CONFIG.MAX_SESSIONS_PER_USER) {
            Logger.warn('Max sessions reached', {
                userId: user.id,
                sessionCount: activeSessionCount,
                maxAllowed: AUTH_CONFIG.MAX_SESSIONS_PER_USER
            });
            
            // Create error with empty sessions array since we only need the count
            throw new MaxSessionsError([], user.id);
        }

        // Generate tokens if all checks pass
        const tokens = await TokenService.generateTokens(user.id, deviceInfo);
        return {
            success: true,
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                username: user.username
            }
        };
    } catch (error) {
        Logger.error('Authentication failed', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
        };
    }
}

export async function logout(userId: number, tokenId: string): Promise<void> {
    try {
        await TokenService.logout(userId, tokenId);
    } catch (error) {
        Logger.error('Logout failed', { error, userId, tokenId });
        throw error;
    }
}

export class AuthService {
    static async login(username: string, password: string, deviceInfo: DeviceInfo) {
        try {
            const user = await UserModel.findByUsername(username);
            if (!user) {
                throw new AuthError('Invalid credentials', 401);
            }

            if (!user.is_active) {
                throw new AuthError('Invalid credentials', 401);
            }

            const isValid = await UserModel.verifyPassword(user, password);
            if (!isValid) {
                throw new AuthError('Invalid credentials', 401);
            }

            // Get active sessions count
            const activeSessionCount = await TokenService.getActiveSessions(user.id);
            
            // Check if max sessions reached
            if (activeSessionCount >= AUTH_CONFIG.MAX_SESSIONS_PER_USER) {
                Logger.warn('Max sessions reached', {
                    userId: user.id,
                    sessionCount: activeSessionCount,
                    maxAllowed: AUTH_CONFIG.MAX_SESSIONS_PER_USER
                });
                
                // Create error with empty sessions array
                throw new MaxSessionsError([], user.id);
            }

            return await TokenService.generateTokens(user.id, deviceInfo);
        } catch (error) {
            Logger.error('Login failed', error);
            throw error;
        }
    }

    static async logout(sessionId: string, userId: number): Promise<boolean> {
        await query('BEGIN');
        try {
            // Get token_id before deleting session
            const sessionResult = await query(
                'SELECT token_id FROM user_sessions_wa WHERE id = $1 AND user_id = $2',
                [sessionId, userId]
            );

            if (!sessionResult.rows[0]) {
                throw new AuthError('Session not found', 404);
            }

            // Mark session for deletion
            await query(
                `UPDATE user_sessions_wa 
                 SET is_marked_for_deletion = true,
                 marked_at = NOW()
                 WHERE id = $1 AND user_id = $2`,
                [sessionId, userId]
            );

            // Revoke refresh token
            await query(
                'UPDATE refresh_tokens_wa SET is_revoked = true WHERE token_id = $1',
                [sessionResult.rows[0].token_id]
            );

            await query('COMMIT');
            return true;
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    static async verifyToken(token: string) {
        try {
            return await TokenService.verifyToken(token);
        } catch (error) {
            Logger.error('Token verification failed', error);
            throw error;
        }
    }

    static async refreshToken(refreshToken: string): Promise<TokenResponse> {
        try {
            // Verify refresh token is still valid in database
            const tokenValid = await TokenService.isRefreshTokenValid(refreshToken);
            if (!tokenValid) {
                throw new AuthError('Invalid refresh token', 401);
            }

            // Rotate tokens instead of just refreshing access token
            return await TokenService.rotateTokens(refreshToken);
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthError('Refresh token expired', 401);
            }
            throw error;
        }
    }
} 
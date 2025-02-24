import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { UserModel } from '../models/User';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../services/logger';
import { query } from '../config/database';
import ms = require('ms');
import { TokenPayload, DeviceInfo, TokenResponse } from '../types/auth';
import { AuthError } from '../services/errors';
import { UserOfWA } from '../types/user';
import { QueryResult } from 'pg';
import { scheduleMarkedSessionCleanup } from '../jobs/markedSessionsCleanup';

function requireEnvVar(name: string, fallback?: string): string {
    const value = process.env[name];
    if (!value) {
        if (fallback !== undefined) {
            Logger.auth(`Using fallback value for ${name}`, { fallback });
            return fallback;
        }
        throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
}

// Load from environment variables with validation
export const AUTH_CONFIG = {
    JWT_SECRET: requireEnvVar('JWT_SECRET'),
    TOKEN_EXPIRATION: requireEnvVar('TOKEN_EXPIRATION', '1h') as StringValue,
    TOKEN_ALGORITHM: 'HS256' as const,
    REFRESH_TOKEN_EXPIRATION: requireEnvVar('REFRESH_TOKEN_EXPIRATION', '7d') as StringValue,
    PASSWORD_HASH_ROUNDS: parseInt(requireEnvVar('PASSWORD_HASH_ROUNDS', '10')),
    MAX_SESSIONS_PER_USER: parseInt(requireEnvVar('MAX_SESSIONS_PER_USER', '3')),
    SESSION_INACTIVE_TIMEOUT: requireEnvVar('SESSION_INACTIVE_TIMEOUT', '7d') as StringValue
} as const;

// Validate configuration at startup
(() => {
    try {
        // Validate JWT_SECRET length
        if (AUTH_CONFIG.JWT_SECRET.length < 32) {
            throw new Error('JWT_SECRET must be at least 32 characters long');
        }

        // Validate numeric values
        if (AUTH_CONFIG.PASSWORD_HASH_ROUNDS < 10 || AUTH_CONFIG.PASSWORD_HASH_ROUNDS > 20) {
            throw new Error('PASSWORD_HASH_ROUNDS must be between 10 and 20');
        }

        if (AUTH_CONFIG.MAX_SESSIONS_PER_USER < 1) {
            throw new Error('MAX_SESSIONS_PER_USER must be at least 1');
        }

        Logger.auth('Auth configuration loaded successfully', {
            tokenExpiration: AUTH_CONFIG.TOKEN_EXPIRATION,
            maxSessions: AUTH_CONFIG.MAX_SESSIONS_PER_USER,
            algorithm: AUTH_CONFIG.TOKEN_ALGORITHM
        });
    } catch (error) {
        Logger.error('Invalid auth configuration', error);
        process.exit(1);
    }
})();

// Add after TokenPayload interface
export interface RefreshToken {
    id: string;
    userId: number;
    tokenId: string;
    expiresAt: Date;
    isRevoked: boolean;
}

// Add new custom error class
export class MaxSessionsError extends Error {
    constructor(
        public sessions: any[],
        public userId: number
    ) {
        super('Maximum number of sessions reached');
        this.name = 'MaxSessionsError';
        
        // Ensure userId is set
        if (typeof userId !== 'number') {
            console.error('Invalid userId type:', { userId, type: typeof userId });
            throw new Error('Invalid userId provided to MaxSessionsError');
        }
        
        console.log('MaxSessionsError constructor:', {
            sessions: sessions.length,
            userId,
            name: this.name
        });
    }
}

export class TokenService {
    private static async createSession(userId: number, tokenId: string, deviceInfo: DeviceInfo): Promise<void> {
        await this.enforceSessionLimit(userId);

        const friendlyName = `${deviceInfo.browser} on ${deviceInfo.os}`;

        await query(
            `INSERT INTO user_sessions_wa (
                user_id, token_id, device_type, device_os, 
                device_browser, friendly_name
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                tokenId,
                deviceInfo.type,
                deviceInfo.os,
                deviceInfo.browser,
                friendlyName
            ]
        );
    }

    static async generateTokens(userId: number, deviceInfo: DeviceInfo, skipLimitCheck = false): Promise<TokenResponse> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AuthError('User not found', 404);
        }

        // Skip session limit check for pre-login
        if (!skipLimitCheck) {
            const activeSessions = await this.getActiveSessions(user.id);
            if (activeSessions.length >= AUTH_CONFIG.MAX_SESSIONS_PER_USER) {
                throw new MaxSessionsError(activeSessions, user.id);
            }
        }

        const tokenId = uuidv4();
        const payload: TokenPayload = {
            userId: user.id,
            username: user.username,
            tokenId,
            role: user.role
        };

        // Generate access token
        const token = jwt.sign(payload, AUTH_CONFIG.JWT_SECRET, {
            expiresIn: AUTH_CONFIG.TOKEN_EXPIRATION
        });

        // Generate refresh token
        const refreshToken = await this.generateRefreshToken(user.id, tokenId);

        // Create session
        await this.createSession(user.id, tokenId, deviceInfo);

        return { 
            token, 
            refreshToken,
            sessionId: tokenId
        };
    }

    private static async enforceSessionLimit(userId: number): Promise<void> {
        const { query } = await import('../config/database');
        
        const result = await query(
            'SELECT COUNT(*) FROM user_sessions_wa WHERE user_id = $1',
            [userId]
        );

        const sessionCount = parseInt(result.rows[0].count);

        if (sessionCount >= AUTH_CONFIG.MAX_SESSIONS_PER_USER) {
            await query(
                'DELETE FROM user_sessions_wa WHERE id IN (SELECT id FROM user_sessions_wa WHERE user_id = $1 ORDER BY last_active ASC LIMIT 1)',
                [userId]
            );
        }
    }

    static async storeSession(
        userId: number, 
        tokenId: string, 
        deviceInfo: string,
        friendlyName: string,
        ip?: string
    ): Promise<void> {
        const { query } = await import('../config/database');
        const deviceData = JSON.parse(deviceInfo);
        
        await query(
            `INSERT INTO user_sessions_wa (
                user_id, token_id, device_info, 
                device_type, device_browser, device_os,
                device_last_seen, friendly_name, created_from_ip,
                is_current_session
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                userId,
                tokenId,
                deviceInfo,
                deviceData.type,
                deviceData.browser,
                deviceData.os,
                deviceData.timestamp,
                friendlyName,
                ip || null,
                true
            ]
        );
    }

    static async verifyToken(token: string): Promise<TokenPayload> {
        try {
            const decoded = jwt.verify(token, AUTH_CONFIG.JWT_SECRET) as TokenPayload;
            
            // Verify session exists
            const session = await query(
                'SELECT * FROM user_sessions_wa WHERE token_id = $1 AND user_id = $2',
                [decoded.tokenId, decoded.userId]
            );

            if (!session.rows[0]) {
                throw new AuthError('Session not found', 401);
            }

            // Update last active timestamp using the public method
            await TokenService.updateSessionActivity(decoded.tokenId);

            return decoded;
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthError('Invalid token', 401);
            }
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthError('Token expired', 401);
            }
            throw error;
        }
    }

    private static async validateSession(tokenId: string): Promise<boolean> {
        const { query } = await import('../config/database');
        
        const result = await query(
            'SELECT id FROM user_sessions_wa WHERE token_id = $1',
            [tokenId]
        );
        return result.rows.length > 0;
    }

    static async invalidateSession(tokenId: string): Promise<void> {
        await query(
            'DELETE FROM user_sessions_wa WHERE token_id = $1',
            [tokenId]
        );
    }

    static async invalidateAllUserSessions(userId: number): Promise<void> {
        const { query } = await import('../config/database');
        
        await query(
            'DELETE FROM user_sessions_wa WHERE user_id = $1',
            [userId]
        );
    }

    static async isSessionValid(tokenId: string): Promise<boolean> {
        try {
            const { query } = await import('../config/database');
            
            const result = await query(
                'SELECT token_id FROM user_sessions_wa WHERE token_id = $1',
                [tokenId]
            );

            return result.rows.length > 0;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    static async debugSessionState(tokenId: string): Promise<void> {
        try {
            const { query } = await import('../config/database');
            const result = await query(
                'SELECT * FROM user_sessions_wa WHERE token_id = $1',
                [tokenId]
            );
            
            console.log('Current session state:', {
                tokenId,
                exists: result.rows.length > 0,
                session: result.rows[0],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to debug session state:', {
                tokenId,
                error,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Add new method to get active sessions
    static async getActiveSessions(userId: number) {
        const result = await query(
            `SELECT 
                id,
                token_id,
                device_type,
                device_os,
                device_browser,
                friendly_name,
                last_active,
                created_at
            FROM user_sessions_wa 
            WHERE user_id = $1 
            ORDER BY last_active DESC`,
            [userId]
        );

        return result.rows;
    }

    //method to terminate session
    static async terminateSession(userId: number, sessionId: string): Promise<boolean> {
        const { query } = await import('../config/database');
        
        try {
            console.log('TokenService: Attempting to terminate session:', {
                userId,
                sessionId,
                timestamp: new Date().toISOString()
            });

            const result = await query(
                `DELETE FROM user_sessions_wa 
                 WHERE id = $1 AND user_id = $2 
                 RETURNING id`,
                [sessionId, userId]
            );

            // Add type guard for rowCount
            const rowCount = result?.rowCount ?? 0;
            const success = rowCount > 0;
            
            console.log('TokenService: Session termination result:', {
                success,
                rowsAffected: rowCount,
                userId,
                sessionId,
                timestamp: new Date().toISOString()
            });

            return success;
        } catch (error) {
            console.error('TokenService: Failed to terminate session:', {
                error,
                userId,
                sessionId,
                timestamp: new Date().toISOString()
            });
            return false;
        }
    }

    static async generateRefreshToken(userId: number, tokenId: string): Promise<string> {
        const refreshTokenId = uuidv4();
        const expiresAt = new Date(Date.now() + ms(AUTH_CONFIG.REFRESH_TOKEN_EXPIRATION));

        await query(
            `INSERT INTO refresh_tokens (id, user_id, token_id, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [refreshTokenId, userId, tokenId, expiresAt]
        );

        return refreshTokenId;
    }

    static async refreshAccessToken(refreshTokenId: string): Promise<{ token: string; user: UserOfWA } | null> {
        const result = await query(
            `SELECT rt.*, u.* FROM refresh_tokens rt
             JOIN users u ON u.id = rt.user_id
             WHERE rt.id = $1 AND rt.expires_at > NOW() AND NOT rt.is_revoked`,
            [refreshTokenId]
        );

        if (!result.rows[0]) {
            return null;
        }

        const { user_id, token_id } = result.rows[0];
        const user = await UserModel.findById(user_id);

        if (!user) {
            return null;
        }

        // Generate new access token with same session ID
        const newToken = jwt.sign(
            { userId: user.id, username: user.username, tokenId: token_id },
            AUTH_CONFIG.JWT_SECRET,
            { expiresIn: AUTH_CONFIG.TOKEN_EXPIRATION }
        );

        return { token: newToken, user };
    }

    static async revokeRefreshToken(refreshTokenId: string): Promise<void> {
        await query(
            'UPDATE refresh_tokens SET is_revoked = true WHERE id = $1',
            [refreshTokenId]
        );
    }

    static async logout(userId: number, tokenId: string): Promise<void> {
        try {
            Logger.auth('Starting logout process', { userId, tokenId });
            
            // Begin transaction
            await query('BEGIN');
            
            // Delete active session
            await query(
                'DELETE FROM user_sessions_wa WHERE user_id = $1 AND token_id = $2',
                [userId, tokenId]
            );

            // Mark refresh token as revoked (don't delete)
            await query(
                'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND token_id = $2',
                [userId, tokenId]
            );

            // Commit transaction
            await query('COMMIT');
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    static async isRefreshTokenValid(tokenId: string): Promise<boolean> {
        const result = await query(
            `SELECT EXISTS (
                SELECT 1 FROM refresh_tokens 
                WHERE token_id = $1 
                AND NOT is_revoked 
                AND expires_at > NOW()
            )`,
            [tokenId]
        );
        return result.rows[0].exists;
    }

    static async cleanupExpiredTokens(): Promise<{
        tokensDeleted: number;
        sessionsDeleted: number;
    }> {
        try {
            // Delete expired and revoked tokens older than X days
            const tokenResult = await query(`
                DELETE FROM refresh_tokens 
                WHERE (expires_at < NOW() OR is_revoked = true)
                AND created_at < NOW() - INTERVAL '30 days'
                RETURNING id
            `);

            // Cleanup orphaned sessions
            const sessionResult = await query(`
                DELETE FROM user_sessions_wa 
                WHERE token_id NOT IN (
                    SELECT token_id FROM refresh_tokens 
                    WHERE NOT is_revoked AND expires_at > NOW()
                )
                RETURNING id
            `);

            return {
                tokensDeleted: tokenResult.rowCount || 0,
                sessionsDeleted: sessionResult.rowCount || 0
            };
        } catch (error) {
            Logger.error('Token cleanup failed', error);
            throw error;
        }
    }

    static async generateTokensWithPreLogin(userId: number, deviceInfo: DeviceInfo, oldSessionId: string): Promise<TokenResponse> {
        await query('BEGIN');
        try {
            // Force delete both session and refresh token
            await query(
                `DELETE FROM user_sessions_wa WHERE id = $1;
                 DELETE FROM refresh_tokens WHERE token_id = (
                     SELECT token_id FROM user_sessions_wa WHERE id = $1
                 );`,
                [oldSessionId]
            );

            // Verify deletion completed
            const verifyDeletion = await query(
                'SELECT COUNT(*) FROM user_sessions_wa WHERE id = $1',
                [oldSessionId]
            );
            
            if (verifyDeletion.rows[0].count > 0) {
                throw new Error('Failed to delete old session');
            }
            
            // Generate new session
            const tokens = await this.generateTokens(userId, deviceInfo, true);
            
            await query('COMMIT');
            return tokens;
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    static async handleExpiredToken(tokenId: string): Promise<void> {
        try {
            // Check if refresh token is still valid
            const refreshToken = await query(
                `SELECT * FROM refresh_tokens 
                 WHERE token_id = $1 AND NOT is_revoked AND expires_at > NOW()`,
                [tokenId]
            );

            if (!refreshToken.rows[0]) {
                // Refresh token expired or revoked - clean up session
                await this.cleanupExpiredSession(tokenId);
            }
            // If refresh token valid, keep session for potential refresh
        } catch (error) {
            Logger.error('Error handling expired token', { error, tokenId });
        }
    }

    static async cleanupExpiredSession(tokenId: string): Promise<void> {
        try {
            await query('BEGIN');

            // Revoke refresh token
            await query(
                `UPDATE refresh_tokens 
                 SET is_revoked = true 
                 WHERE token_id = $1`,
                [tokenId]
            );

            // Delete session
            await query(
                'DELETE FROM user_sessions_wa WHERE token_id = $1',
                [tokenId]
            );

            await query('COMMIT');
            
            Logger.auth('Session cleaned up', { tokenId });
        } catch (error) {
            await query('ROLLBACK');
            Logger.error('Failed to cleanup session', { error, tokenId });
            throw error;
        }
    }

    static async updateSessionActivity(tokenId: string): Promise<void> {
        try {
            await query(
                'UPDATE user_sessions_wa SET last_active = NOW() WHERE token_id = $1',
                [tokenId]
            );
        } catch (error) {
            Logger.error('Failed to update session activity', { error, tokenId });
        }
    }
} 
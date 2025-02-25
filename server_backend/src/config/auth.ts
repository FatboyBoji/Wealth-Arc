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
import { CookieOptions } from 'express';
import { SessionManager } from '../services/SessionManager';

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
        public sessions: any[] = [],
        public userId: number
    ) {
        super('Maximum number of sessions reached');
        this.name = 'MaxSessionsError';
        
        if (typeof userId !== 'number') {
            Logger.error('Invalid userId type', { userId, type: typeof userId });
            throw new Error('Invalid userId provided to MaxSessionsError');
        }
    }
}

// Add cookie configuration
const COOKIE_CONFIG: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ms(AUTH_CONFIG.REFRESH_TOKEN_EXPIRATION),
    path: '/api/auth'
};

export class TokenService {
    static async createSession(userId: number, deviceInfo: DeviceInfo, tokenId?: string): Promise<string> {
        await this.enforceSessionLimit(userId);
        
        // Generate tokenId if not provided
        const sessionTokenId = tokenId || uuidv4();
        
        const friendlyName = `${deviceInfo.browser} on ${deviceInfo.os}`;
        
        await query(`
            INSERT INTO user_sessions_wa (
                user_id, 
                token_id,
                device_type,
                device_name,
                browser,
                os,
                last_active,
                last_ip
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
            RETURNING id`,
            [
                userId,
                sessionTokenId,
                deviceInfo.type,
                deviceInfo.name,
                deviceInfo.browser,
                deviceInfo.os,
                deviceInfo.ip
            ]
        );

        return sessionTokenId;
    }

    static async generateTokens(userId: number, deviceInfo: DeviceInfo): Promise<TokenResponse> {
        const tokenId = await this.createSession(userId, deviceInfo);
        const accessToken = jwt.sign(
            { userId, tokenId },
            AUTH_CONFIG.JWT_SECRET,
            { expiresIn: AUTH_CONFIG.TOKEN_EXPIRATION }
        );

        const refreshToken = jwt.sign(
            { userId, tokenId },
            AUTH_CONFIG.JWT_SECRET,
            { expiresIn: AUTH_CONFIG.REFRESH_TOKEN_EXPIRATION }
        );

        // Store refresh token in database
        await query(
            `INSERT INTO refresh_tokens_wa (id, user_id, token_id, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [
                uuidv4(),
                userId,
                tokenId,
                new Date(Date.now() + ms(AUTH_CONFIG.REFRESH_TOKEN_EXPIRATION))
            ]
        );

        return {
            token: accessToken,
            refreshToken,
            sessionId: tokenId,
            cookieConfig: COOKIE_CONFIG
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
    static async getActiveSessions(userId: number): Promise<number> {
        const result = await query(`
            SELECT COUNT(*) 
            FROM user_sessions_wa 
            WHERE user_id = $1 
            AND NOT is_marked_for_deletion
        `, [userId]);

        return parseInt(result.rows[0].count);
    }

    //method to terminate session
    static async terminateSession(userId: number, sessionId: string): Promise<void> {
        try {
            // Replace old cleanup with new one
            await SessionManager.markSessionForDeletion(sessionId, userId);
        } catch (error) {
            Logger.error('Failed to terminate session', error);
            throw error;
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

    static async rotateTokens(refreshToken: string): Promise<TokenResponse> {
        await query('BEGIN');
        try {
            const decoded = jwt.verify(refreshToken, AUTH_CONFIG.JWT_SECRET) as TokenPayload;
            
            // Verify token is valid and not revoked
            const tokenValid = await this.isRefreshTokenValid(refreshToken);
            if (!tokenValid) {
                throw new AuthError('Invalid refresh token', 401);
            }

            // Get device info from session
            const sessionResult = await query(`
                SELECT device_type, device_name, browser, os, last_ip 
                FROM user_sessions_wa 
                WHERE token_id = $1
            `, [decoded.tokenId]);

            if (!sessionResult.rows[0]) {
                throw new AuthError('Session not found', 401);
            }

            const deviceInfo: DeviceInfo = {
                type: sessionResult.rows[0].device_type,
                name: sessionResult.rows[0].device_name,
                browser: sessionResult.rows[0].browser,
                os: sessionResult.rows[0].os,
                ip: sessionResult.rows[0].last_ip
            };

            // Generate new tokens
            const newTokens = await this.generateTokens(decoded.userId, deviceInfo);

            // Revoke old refresh token
            await query(
                'UPDATE refresh_tokens_wa SET is_revoked = true WHERE token_id = $1',
                [decoded.tokenId]
            );

            await query('COMMIT');
            return newTokens;
        } catch (error) {
            await query('ROLLBACK');
            if (error instanceof AuthError) {
                throw error;
            }
            throw new AuthError('Failed to rotate tokens', 401);
        }
    }

    static async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
        try {
            // Verify refresh token is still valid in database
            const tokenValid = await this.isRefreshTokenValid(refreshToken);
            if (!tokenValid) {
                throw new AuthError('Invalid refresh token', 401);
            }

            // Rotate tokens instead of just refreshing access token
            return await this.rotateTokens(refreshToken);

        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthError('Refresh token expired', 401);
            }
            throw error;
        }
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

            // Mark refresh token as revoked (using correct table name)
            await query(
                'UPDATE refresh_tokens_wa SET is_revoked = true WHERE user_id = $1 AND token_id = $2',
                [userId, tokenId]
            );

            // Verify the refresh token was revoked
            const verifyRevoked = await query(
                'SELECT is_revoked FROM refresh_tokens_wa WHERE token_id = $1',
                [tokenId]
            );

            if (!verifyRevoked.rows[0]?.is_revoked) {
                throw new Error('Failed to revoke refresh token');
            }

            // Commit transaction
            await query('COMMIT');

            Logger.auth('Logout successful', {
                userId,
                tokenId,
                refreshTokenRevoked: true
            });
        } catch (error) {
            await query('ROLLBACK');
            Logger.error('Logout failed', error);
            throw error;
        }
    }

    static async isRefreshTokenValid(refreshToken: string): Promise<boolean> {
        try {
            const decoded = jwt.verify(refreshToken, AUTH_CONFIG.JWT_SECRET) as TokenPayload;
            const result = await query(
                `SELECT EXISTS (
                    SELECT 1 FROM refresh_tokens_wa 
                    WHERE token_id = $1 
                    AND NOT is_revoked 
                    AND expires_at > NOW()
                )`,
                [decoded.tokenId]
            );
            return result.rows[0].exists;
        } catch (error) {
            return false;
        }
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
            const tokens = await this.generateTokens(userId, deviceInfo);
            
            await query('COMMIT');
            return tokens;
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    static async handleExpiredToken(tokenId: string): Promise<void> {
        try {
            await query('BEGIN');
            
            // Mark session for deletion
            await query(`
                UPDATE user_sessions_wa 
                SET is_marked_for_deletion = true,
                marked_at = NOW()
                WHERE token_id = $1
            `, [tokenId]);

            // Revoke refresh token
            await query(`
                UPDATE refresh_tokens_wa 
                SET is_revoked = true 
                WHERE token_id = $1
            `, [tokenId]);

            // Delete session immediately if refresh token is also expired
            const refreshTokenValid = await query(`
                SELECT EXISTS (
                    SELECT 1 FROM refresh_tokens_wa 
                    WHERE token_id = $1 
                    AND NOT is_revoked 
                    AND expires_at > NOW()
                )
            `, [tokenId]);

            if (!refreshTokenValid.rows[0].exists) {
                await query(`
                    DELETE FROM user_sessions_wa 
                    WHERE token_id = $1
                `, [tokenId]);
            }

            await query('COMMIT');
            
            Logger.auth('Token expired - Session handled', { 
                tokenId,
                refreshTokenValid: refreshTokenValid.rows[0].exists 
            });
        } catch (error) {
            await query('ROLLBACK');
            Logger.error('Failed to handle expired token', { error, tokenId });
        }
    }

    // Add this method to clean up expired sessions
    static async cleanupExpiredSessions(): Promise<void> {
        try {
            await query('BEGIN');

            // Delete marked sessions older than 5 minutes
            await query(`
                DELETE FROM user_sessions_wa 
                WHERE is_marked_for_deletion = true 
                AND marked_at < NOW() - INTERVAL '5 minutes'
            `);

            // Clean up orphaned refresh tokens
            await query(`
                UPDATE refresh_tokens_wa 
                SET is_revoked = true 
                WHERE token_id NOT IN (
                    SELECT token_id FROM user_sessions_wa
                )
            `);

            await query('COMMIT');
        } catch (error) {
            await query('ROLLBACK');
            Logger.error('Failed to cleanup sessions', error);
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
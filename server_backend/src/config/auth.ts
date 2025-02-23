import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { User } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

// Load from environment variables with fallbacks
export const AUTH_CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    TOKEN_EXPIRATION: '24h' as StringValue,
    TOKEN_ALGORITHM: 'HS256' as const,
    REFRESH_TOKEN_EXPIRATION: '7d' as StringValue,
    PASSWORD_HASH_ROUNDS: 10,
    MAX_SESSIONS_PER_USER: 3, // Maximum number of active sessions per user
    SESSION_INACTIVE_TIMEOUT: '7d' as StringValue // Auto-remove sessions after 7 days of inactivity
} as const;

export interface TokenPayload {
    userId: number;
    username: string;
    tokenId: string; // Add unique identifier for each token
    iat?: number;
    exp?: number;
}

export class TokenService {
    static async generateToken(user: User, deviceInfo?: string): Promise<string> {
        const tokenId = uuidv4();
        
        // Check and enforce session limit
        await this.enforceSessionLimit(user.id);
        
        const payload: TokenPayload = {
            userId: user.id,
            username: user.username,
            tokenId
        };

        const options: SignOptions = {
            expiresIn: AUTH_CONFIG.TOKEN_EXPIRATION,
            algorithm: AUTH_CONFIG.TOKEN_ALGORITHM
        };

        const token = jwt.sign(payload, AUTH_CONFIG.JWT_SECRET, options);

        // Store session information
        await this.storeSession(user.id, tokenId, deviceInfo);

        return token;
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

    private static async storeSession(userId: number, tokenId: string, deviceInfo?: string): Promise<void> {
        const { query } = await import('../config/database');
        
        await query(
            'INSERT INTO user_sessions_wa (user_id, token_id, device_info) VALUES ($1, $2, $3)',
            [userId, tokenId, deviceInfo || 'Unknown device']
        );
    }

    static async verifyToken(token: string): Promise<TokenPayload> {
        try {
            const decoded = jwt.verify(token, AUTH_CONFIG.JWT_SECRET) as TokenPayload;
            
            // Verify session exists and is active
            const isValidSession = await this.validateSession(decoded.tokenId);
            if (!isValidSession) {
                console.log('Session invalid or expired:', {
                    tokenId: decoded.tokenId,
                    userId: decoded.userId,
                    timestamp: new Date().toISOString()
                });
                // Ensure session is removed
                await this.invalidateSession(decoded.tokenId);
                throw new Error('Session expired or invalid');
            }

            // Update last active timestamp
            await this.updateSessionActivity(decoded.tokenId);

            return decoded;
        } catch (error) {
            console.error('Token verification failed:', {
                error,
                timestamp: new Date().toISOString()
            });

            // If we have token info, always clean up the session
            if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
                try {
                    const decoded = jwt.decode(token) as TokenPayload;
                    if (decoded?.tokenId) {
                        console.log('Cleaning up invalid session:', {
                            tokenId: decoded.tokenId,
                            userId: decoded.userId,
                            timestamp: new Date().toISOString()
                        });
                        await this.invalidateSession(decoded.tokenId);
                    }
                } catch (cleanupError) {
                    console.error('Failed to cleanup session:', cleanupError);
                }
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

    private static async updateSessionActivity(tokenId: string): Promise<void> {
        const { query } = await import('../config/database');
        
        await query(
            'UPDATE user_sessions_wa SET last_active = CURRENT_TIMESTAMP WHERE token_id = $1',
            [tokenId]
        );
    }

    static async invalidateSession(tokenId: string): Promise<void> {
        try {
            const { query } = await import('../config/database');
            
            console.log('Attempting to invalidate session:', {
                tokenId,
                timestamp: new Date().toISOString()
            });

            const result = await query(
                'DELETE FROM user_sessions_wa WHERE token_id = $1 RETURNING id, user_id',
                [tokenId]
            );

            console.log('Session invalidation result:', {
                tokenId,
                rowsAffected: result.rowCount,
                deletedSession: result.rows[0],
                timestamp: new Date().toISOString()
            });

            if (result.rowCount === 0) {
                console.warn('No session found to invalidate:', {
                    tokenId,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Failed to invalidate session:', {
                tokenId,
                error,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
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
} 
import { query } from '../config/database';
import { AUTH_CONFIG } from '../config/auth';
import ms from 'ms';
import jwt from 'jsonwebtoken';
import { Logger } from '../services/logger';


interface CleanupMetrics {
    startTime: number;
    sessionsChecked: number;
    sessionsDeleted: number;
    errors: number;
    duration: number;
}

class RetryableError extends Error {
    constructor(message: string, public retryCount: number = 0) {
        super(message);
        this.name = 'RetryableError';
    }
}

export async function cleanupInactiveSessions(retryCount = 0): Promise<void> {
    const metrics: CleanupMetrics = {
        startTime: Date.now(),
        sessionsChecked: 0,
        sessionsDeleted: 0,
        errors: 0,
        duration: 0
    };

    try {
        Logger.jobs('Starting session cleanup', {
            attempt: retryCount + 1,
            timestamp: new Date().toISOString()
        });

        const inactiveThreshold = ms(AUTH_CONFIG.SESSION_INACTIVE_TIMEOUT);
        
        // Get all sessions
        const sessions = await query(
            `SELECT token_id, user_id, last_active 
             FROM user_sessions_wa
             WHERE last_active < NOW() - INTERVAL '${AUTH_CONFIG.SESSION_INACTIVE_TIMEOUT}'`
        );

        metrics.sessionsChecked = sessions.rows.length;
        const sessionsToDelete: string[] = [];

        // Check each session's token
        for (const session of sessions.rows) {
            try {
                // Try to verify the token
                jwt.verify(session.token_id, AUTH_CONFIG.JWT_SECRET);
                
                // Check if session is inactive
                const lastActive = new Date(session.last_active);
                const now = new Date();
                if (now.getTime() - lastActive.getTime() > inactiveThreshold) {
                    sessionsToDelete.push(session.token_id);
                }
            } catch (error) {
                // If token verification fails (expired or invalid), mark for deletion
                sessionsToDelete.push(session.token_id);
                metrics.errors++;
            }
        }

        if (sessionsToDelete.length > 0) {
            // Also cleanup related refresh tokens
            await query(
                `WITH deleted_sessions AS (
                    DELETE FROM user_sessions_wa 
                    WHERE token_id = ANY($1)
                    RETURNING user_id, token_id
                )
                UPDATE refresh_tokens 
                SET is_revoked = true
                WHERE token_id IN (SELECT token_id FROM deleted_sessions)`,
                [sessionsToDelete]
            );

            metrics.sessionsDeleted = sessionsToDelete.length;
        }

        metrics.duration = Date.now() - metrics.startTime;

        Logger.jobs('Sessions cleanup completed', {
            metrics,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        metrics.duration = Date.now() - metrics.startTime;
        metrics.errors++;

        Logger.error('Session cleanup failed', {
            error,
            metrics,
            timestamp: new Date().toISOString()
        });

        // Implement retry mechanism
        if (retryCount < 3) {
            const nextRetryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            Logger.jobs('Scheduling cleanup retry', {
                attempt: retryCount + 1,
                delay: nextRetryDelay,
                timestamp: new Date().toISOString()
            });

            setTimeout(() => {
                cleanupInactiveSessions(retryCount + 1)
                    .catch(retryError => {
                        Logger.error('Cleanup retry failed', {
                            error: retryError,
                            finalAttempt: retryCount === 2,
                            timestamp: new Date().toISOString()
                        });
                    });
            }, nextRetryDelay);
        }
    }
}

// Run cleanup every 15 minutes
const CLEANUP_INTERVAL = 15 * 60 * 1000;
const MARKED_SESSION_CHECK_INTERVAL = 1000; // 1 second

let cleanupInterval: NodeJS.Timeout;
let markedSessionsInterval: NodeJS.Timeout;

export function startCleanupJobs(): void {
    // Regular cleanup (existing)
    cleanupInterval = setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
    
    // Marked sessions cleanup (new)
    markedSessionsInterval = setInterval(async () => {
        try {
            const deletedCount = await cleanupMarkedSessions();
            if (deletedCount > 0) {
                Logger.jobs('Marked sessions cleanup completed', { deletedCount });
            }
        } catch (error) {
            Logger.error('Marked sessions cleanup failed', { error });
        }
    }, MARKED_SESSION_CHECK_INTERVAL);
}

export function stopCleanupJobs(): void {
    clearInterval(cleanupInterval);
    clearInterval(markedSessionsInterval);
    Logger.jobs('All cleanup jobs stopped');
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    stopCleanupJobs();
});

const MARKED_SESSION_MAX_AGE = 5000; // 5 seconds

export const cleanupMarkedSessions = async () => {
    const result = await query(
        `DELETE FROM user_sessions_wa 
         WHERE is_marked_for_deletion = TRUE 
         AND marked_at < NOW() - INTERVAL '5 seconds'
         RETURNING id`
    );
    
    return result.rowCount || 0;
}; 
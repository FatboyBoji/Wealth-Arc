import { CronJob } from 'cron';
import { query } from '../config/database';
import { Logger } from './logger';
import { AUTH_CONFIG } from '../config/auth';
import ms from 'ms';
import { Metrics } from '../types/metrics';

interface CleanupMetrics {
    expiredTokens: number;
    expiredSessions: number;
    inactiveSessions: number;
    markedSessions: number;
}

interface SessionMetrics extends Metrics {
    activeSessionCount: number;
    cleanupDuration: number;
    lastCleanupTime: Date;
    errorCount: number;
}

export interface SessionInfo {
    id: string;
    token_id: string;
    device_type: string;
    device_name: string;
    browser: string;
    os: string;
    last_active: Date;
    created_at: Date;
}

export class SessionManager {
    private static cleanupJob: CronJob;
    private static metrics: SessionMetrics = {
        activeSessionCount: 0,
        cleanupDuration: 0,
        lastCleanupTime: new Date(),
        errorCount: 0
    };

    /**
     * Main cleanup method that handles all session cleanup tasks
     */
    static async cleanup(): Promise<CleanupMetrics> {
        const startTime = Date.now();
        try {
            await query('BEGIN');

            // Clean up marked sessions first
            const markedResult = await query(`
                DELETE FROM user_sessions_wa 
                WHERE is_marked_for_deletion = true 
                RETURNING id
            `);

            // Clean up expired tokens
            const expiredTokensResult = await query(`
                UPDATE refresh_tokens_wa 
                SET is_revoked = true 
                WHERE expires_at < NOW() 
                AND NOT is_revoked
                RETURNING id
            `);

            // Clean up sessions with expired/revoked tokens
            const expiredSessionsResult = await query(`
                DELETE FROM user_sessions_wa 
                WHERE token_id IN (
                    SELECT token_id 
                    FROM refresh_tokens_wa 
                    WHERE is_revoked = true 
                    OR expires_at < NOW()
                )
                RETURNING id
            `);

            await query('COMMIT');

            return {
                expiredTokens: expiredTokensResult.rowCount || 0,
                expiredSessions: expiredSessionsResult.rowCount || 0,
                inactiveSessions: 0,
                markedSessions: markedResult.rowCount || 0
            };
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    /**
     * Mark a session for deletion
     */
    static async markSessionForDeletion(sessionId: string, userId: number): Promise<void> {
        await query(
            `UPDATE user_sessions_wa 
             SET is_marked_for_deletion = true,
             marked_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [sessionId, userId]
        );
    }

    /**
     * Start the cleanup job
     */
    static startCleanupJob(): void {
        // Run every hour
        this.cleanupJob = new CronJob('0 * * * *', async () => {
            try {
                await this.cleanup();
            } catch (error) {
                Logger.error('Scheduled session cleanup failed', error);
            }
        });

        this.cleanupJob.start();
        Logger.jobs('Session cleanup job started');
    }

    /**
     * Stop the cleanup job
     */
    static stopCleanupJob(): void {
        if (this.cleanupJob) {
            this.cleanupJob.stop();
            Logger.jobs('Session cleanup job stopped');
        }
    }

    static async getMetrics(): Promise<SessionMetrics> {
        const result = await query(
            'SELECT COUNT(*) as count FROM user_sessions_wa WHERE last_active > NOW() - INTERVAL \'1 hour\''
        );
        
        this.metrics.activeSessionCount = parseInt(result.rows[0].count);
        return this.metrics;
    }

    static async checkHealth(): Promise<{
        status: 'healthy' | 'unhealthy';
        lastCleanup: Date;
        activeJobs: number;
    }> {
        return {
            status: this.metrics.errorCount > 5 ? 'unhealthy' : 'healthy',
            lastCleanup: this.metrics.lastCleanupTime,
            activeJobs: this.cleanupJob ? 1 : 0
        };
    }

    static async getUserSessions(userId: number): Promise<SessionInfo[]> {
        try {
            const result = await query<SessionInfo>(`
                SELECT 
                    id,
                    token_id,
                    device_type,
                    device_name,
                    browser,
                    os,
                    last_active,
                    created_at
                FROM user_sessions_wa 
                WHERE user_id = $1 
                AND NOT is_marked_for_deletion
                ORDER BY last_active DESC
            `, [userId]);

            return result.rows;
        } catch (error) {
            Logger.error('Failed to get user sessions', error);
            throw error;
        }
    }
} 
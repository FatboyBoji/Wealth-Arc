import { CronJob } from 'cron';
import { TokenService } from '../config/auth';
import { Logger } from '../services/logger';
import { query } from '../config/database';

export const startTokenCleanupJob = (): void => {
    // Run every Sunday at 3 AM
    new CronJob('0 3 * * 0', async () => {
        try {
            Logger.jobs('Starting token cleanup job', { timestamp: new Date() });
            
            const result = await TokenService.cleanupExpiredTokens();
            
            Logger.jobs('Token cleanup completed', { 
                timestamp: new Date(),
                result 
            });
        } catch (error) {
            Logger.error('Token cleanup job failed', error);
        }
    }).start();
};

export const cleanupExpiredTokens = async (): Promise<void> => {
    try {
        await query('BEGIN');

        // Revoke expired refresh tokens
        await query(`
            UPDATE refresh_tokens 
            SET is_revoked = true 
            WHERE expires_at < NOW() 
            AND NOT is_revoked
        `);

        // Delete associated sessions
        await query(`
            DELETE FROM user_sessions_wa 
            WHERE token_id IN (
                SELECT token_id 
                FROM refresh_tokens 
                WHERE expires_at < NOW() 
                OR is_revoked = true
            )
        `);

        await query('COMMIT');
        
        Logger.jobs('Cleaned up expired tokens and sessions');
    } catch (error) {
        await query('ROLLBACK');
        Logger.error('Failed to cleanup expired tokens', { error });
    }
};

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000); 
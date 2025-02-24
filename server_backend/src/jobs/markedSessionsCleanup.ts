import { query } from '../config/database';
import { Logger } from '../services/logger';

const CLEANUP_DELAY = 5000; // 5 seconds

export const scheduleMarkedSessionCleanup = async (sessionId: string) => {
    setTimeout(async () => {
        try {
            await query('BEGIN');

            // Delete the marked session and its refresh tokens
            await query(
                `DELETE FROM refresh_tokens 
                 WHERE token_id IN (
                     SELECT token_id 
                     FROM user_sessions_wa 
                     WHERE id = $1 AND is_marked_for_deletion = TRUE
                 )`,
                [sessionId]
            );

            const result = await query(
                `DELETE FROM user_sessions_wa 
                 WHERE id = $1 AND is_marked_for_deletion = TRUE
                 RETURNING id`,
                [sessionId]
            );

            await query('COMMIT');

            await Logger.session('Marked session cleanup completed', {
                sessionId,
                wasDeleted: result.rowCount ? result.rowCount > 0 : false
            });
        } catch (error) {
            await query('ROLLBACK');
            await Logger.error('Failed to cleanup marked session', {
                sessionId,
                error
            });
        }
    }, CLEANUP_DELAY);
}; 
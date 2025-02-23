import { query } from '../config/database';
import { AUTH_CONFIG } from '../config/auth';
import ms from 'ms';
import jwt from 'jsonwebtoken';

export async function cleanupInactiveSessions(): Promise<void> {
    try {
        const inactiveThreshold = ms(AUTH_CONFIG.SESSION_INACTIVE_TIMEOUT);
        
        // Get all sessions
        const sessions = await query(
            'SELECT token_id, user_id, last_active FROM user_sessions_wa'
        );

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
            }
        }

        if (sessionsToDelete.length > 0) {
            const result = await query(
                `DELETE FROM user_sessions_wa 
                 WHERE token_id = ANY($1)
                 RETURNING user_id, token_id`,
                [sessionsToDelete]
            );

            console.log('Cleaned up sessions:', {
                count: result.rows.length,
                sessions: result.rows,
                timestamp: new Date().toISOString(),
                reasons: 'Token expired or session inactive'
            });
        }
    } catch (error) {
        console.error('Session cleanup failed:', {
            error,
            timestamp: new Date().toISOString()
        });
    }
}

// Run cleanup more frequently (every 15 minutes)
setInterval(cleanupInactiveSessions, 15 * 60 * 1000); 
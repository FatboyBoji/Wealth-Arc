import { Request, Response } from 'express';
import { query } from '../config/database';
import { 
    SessionTerminationError, 
    SESSION_ERROR_CODES,
    PreLoginTerminationRequest,
    PreLoginTerminationResponse,
    SessionErrorCode
} from '../types/session';
import { logToFile } from '../services/logger';
import { Logger } from '../services/logger';

const TERMINATION_LOCK_TIMEOUT = 5000; // 5 seconds

/**
 * Terminates a user session during pre-login phase
 * Used when max sessions are reached and user needs to terminate one
 */
export const terminatePreLoginSession = async (
    req: Request<{}, {}, PreLoginTerminationRequest>, 
    res: Response<PreLoginTerminationResponse>
) => {
    const { userId, sessionId } = req.body;
    const startTime = Date.now();
    
    try {
        await Logger.session('Session termination started', {
            userId,
            sessionId,
            requestBody: req.body,
            requestIP: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Start transaction with timeout
        await query('BEGIN');
        await query('SET LOCAL lock_timeout = $1', [TERMINATION_LOCK_TIMEOUT]);
        
        try {
            // Lock the session row for update with NOWAIT
            const sessionResult = await query(
                'SELECT id, token_id FROM user_sessions_wa WHERE id = $1 AND user_id = $2 FOR UPDATE NOWAIT',
                [sessionId, userId]
            );
            
            await Logger.session('Session lock acquired', { 
                userId, 
                sessionId,
                found: sessionResult.rows.length > 0
            });
            
            if (sessionResult.rows.length === 0) {
                await query('ROLLBACK');
                throw new SessionTerminationError(
                    'Session not found or already terminated',
                    SESSION_ERROR_CODES.SESSION_NOT_FOUND,
                    404
                );
            }

            // Delete the session and related refresh tokens
            await query('DELETE FROM refresh_tokens WHERE token_id = $1', [sessionResult.rows[0].token_id]);
            const deleteResult = await query(
                'DELETE FROM user_sessions_wa WHERE id = $1 AND user_id = $2 RETURNING id',
                [sessionId, userId]
            );

            // Verify session count after deletion
            const { rows: [{ count }] } = await query(
                'SELECT COUNT(*) FROM user_sessions_wa WHERE user_id = $1',
                [userId]
            );

            await Logger.session('Session termination successful', {
                userId,
                sessionId,
                deletedRows: deleteResult.rowCount,
                remainingSessions: count,
                duration: Date.now() - startTime
            });

            await query('COMMIT');
            
            res.json({
                success: true,
                message: 'Session terminated successfully',
                sessionId,
                remainingSessions: parseInt(count)
            });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        await Logger.session('Session termination failed', {
            userId,
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        
        if (error instanceof SessionTerminationError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.code,
                message: error.message,
                sessionId
            });
            return;
        }
        
        res.status(500).json({
            success: false,
            error: SESSION_ERROR_CODES.SERVER_ERROR,
            message: 'Failed to terminate session',
            sessionId
        });
    }
}; 
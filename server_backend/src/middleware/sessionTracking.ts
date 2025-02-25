import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { Logger } from '../services/logger';
import { TokenPayload } from '../types/auth';

export const trackSession = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = req.user as TokenPayload | undefined;
        if (!user?.tokenId) {
            return next();
        }

        // Update last active timestamp and device info
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString()
        };

        await query(`
            UPDATE user_sessions_wa 
            SET last_active = NOW(),
                device_last_seen = $1,
                last_ip = $2,
                activity_count = activity_count + 1
            WHERE token_id = $3
            RETURNING id`,
            [deviceInfo.timestamp, deviceInfo.ip, user.tokenId]
        );

        // Add session tracking headers
        res.setHeader('X-Session-Active', 'true');
        res.setHeader('X-Last-Active', new Date().toISOString());

        next();
    } catch (error) {
        Logger.error('Session tracking failed', error);
        next(); // Continue despite error
    }
}; 
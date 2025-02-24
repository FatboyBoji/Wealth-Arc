import { Router, Request, Response, NextFunction } from 'express';
import { validatePreLoginTermination } from '../middleware/validation';
import { terminatePreLoginSession } from '../controllers/sessionController';
import { rateLimiter } from '../middleware/rateLimiter';
import { logToFile } from '../services/logger';

const router = Router();

// Pre-login session termination route
// No auth middleware needed as this is specifically for pre-login state
router.post(
    '/terminate-pre-login',
    rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10 // Increased limit for testing
    }),
    validatePreLoginTermination,
    async (req: Request, res: Response, next: NextFunction) => {
        await logToFile('Route handler received request', {
            body: req.body,
            path: req.path,
            method: req.method
        });
        next();
    },
    terminatePreLoginSession
);

export default router; 
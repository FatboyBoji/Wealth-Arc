import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../config/auth';
import { UserModel } from '../models/User';
import { RequestHandler } from 'express';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

export const authenticateToken: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            res.status(401).json({ error: 'Authentication token required' });
            return;
        }

        const decoded = verifyToken(token);
        
        // Verify user still exists
        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            res.status(401).json({ error: 'User no longer exists' });
            return;
        }

        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Optional authentication middleware that doesn't require token
export const optionalAuthenticateToken: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            const user = await UserModel.findById(decoded.userId);
            if (user) {
                req.user = decoded;
            }
        }
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
}; 
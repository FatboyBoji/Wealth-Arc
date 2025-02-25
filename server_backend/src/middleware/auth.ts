import { Request, Response, NextFunction } from 'express';
import { TokenService, AUTH_CONFIG } from '../config/auth';
import { TokenPayload } from '../types/auth';
import { UserModel } from '../models/User';
import { RequestHandler } from 'express';
import { Logger } from '../services/logger';
import jwt from 'jsonwebtoken';
import { AuthError } from '../services/errors';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw new AuthError('No token provided', 401);
        }

        try {
            const decoded = await TokenService.verifyToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                // Handle expired token
                const decoded = jwt.decode(token) as any;
                if (decoded?.tokenId) {
                    await TokenService.handleExpiredToken(decoded.tokenId);
                }
                throw new AuthError('Token expired', 401);
            }
            throw new AuthError('Invalid token', 401);
        }
    } catch (error) {
        Logger.error('Authentication failed', error);
        res.status(error instanceof AuthError ? error.status : 401)
           .json({ error: error instanceof Error ? error.message : 'Authentication failed' });
    }
}

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
            const decoded = await TokenService.verifyToken(token);
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
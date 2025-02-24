import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../config/auth';
import { TokenPayload } from '../types/auth';
import { UserModel } from '../models/User';
import { RequestHandler } from 'express';
import { Logger } from '../services/logger';

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
        const token = authHeader?.split(' ')[1];

        if (!token) {
            Logger.auth('Authentication failed', {
                reason: 'No token provided',
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            
            res.status(401).json({ 
                error: 'Authentication token required',
                message: 'No token provided'
            });
            return;
        }

        try {
            const decoded = await TokenService.verifyToken(token);
            
            // Verify user still exists
            const user = await UserModel.findById(decoded.userId);
            if (!user) {
                Logger.auth('Authentication failed', {
                    reason: 'User not found',
                    userId: decoded.userId,
                    tokenId: decoded.tokenId,
                    path: req.path
                });

                await TokenService.invalidateSession(decoded.tokenId);
                res.status(401).json({ 
                    error: 'Authentication failed',
                    message: 'User no longer exists'
                });
                return;
            }

            req.user = decoded;
            Logger.auth('Authentication successful', {
                userId: decoded.userId,
                path: req.path,
                method: req.method
            });
            
            next();
        } catch (tokenError) {
            Logger.error('Token verification failed', {
                error: tokenError,
                path: req.path,
                method: req.method
            });
            
            res.status(403).json({ 
                error: 'Authentication failed',
                message: 'Invalid or expired token'
            });
        }
    } catch (error) {
        Logger.error('Authentication middleware error', {
            error,
            path: req.path,
            method: req.method
        });
        
        res.status(500).json({ 
            error: 'Authentication failed',
            message: 'Internal server error'
        });
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
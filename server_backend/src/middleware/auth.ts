import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../config/auth';
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

export const authenticateToken: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];

        if (!token) {
            Logger.auth('No token provided', { path: req.path });
            res.status(401).json({ 
                error: 'TOKEN_REQUIRED',
                message: 'Authentication token required'
            });
            return;
        }

        try {
            const decoded = await TokenService.verifyToken(token);
            req.user = decoded;
            
            // Check if refresh token is still valid
            const refreshTokenValid = await TokenService.isRefreshTokenValid(decoded.tokenId);
            
            if (!refreshTokenValid) {
                // If refresh token is expired/invalid, clean up the session
                await TokenService.cleanupExpiredSession(decoded.tokenId);
                throw new AuthError('Session expired', 401);
            }
            
            await TokenService.updateSessionActivity(decoded.tokenId);
            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                // Handle expired access token
                const decoded = jwt.decode(token) as TokenPayload;
                if (decoded?.tokenId) {
                    const refreshTokenValid = await TokenService.isRefreshTokenValid(decoded.tokenId);
                    if (!refreshTokenValid) {
                        await TokenService.cleanupExpiredSession(decoded.tokenId);
                    }
                }
                
                res.status(401).json({
                    error: 'TOKEN_EXPIRED',
                    message: 'Token has expired'
                });
                return;
            }
            throw error;
        }
    } catch (error) {
        Logger.error('Authentication failed', { error });
        res.status(401).json({
            error: 'AUTH_ERROR',
            message: 'Authentication failed'
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
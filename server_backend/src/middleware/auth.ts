import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenPayload } from '../config/auth';
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
        const token = authHeader?.split(' ')[1];

        if (!token) {
            console.log('No token provided');
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
                console.log('User no longer exists:', {
                    userId: decoded.userId,
                    tokenId: decoded.tokenId
                });
                // Clean up the session if user doesn't exist
                await TokenService.invalidateSession(decoded.tokenId);
                res.status(401).json({ 
                    error: 'Authentication failed',
                    message: 'User no longer exists'
                });
                return;
            }

            req.user = decoded;
            next();
        } catch (tokenError) {
            console.error('Token verification failed:', {
                error: tokenError,
                timestamp: new Date().toISOString()
            });
            res.status(403).json({ 
                error: 'Authentication failed',
                message: 'Invalid or expired token'
            });
        }
    } catch (error) {
        console.error('Authentication middleware error:', {
            error,
            timestamp: new Date().toISOString()
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
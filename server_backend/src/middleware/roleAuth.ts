import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/user';
import { AuthError } from '../services/errors';
import { TokenPayload } from '../types/auth';

declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

export const requireRole = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role;

        if (!userRole || !allowedRoles.includes(userRole)) {
            throw new AuthError('Insufficient permissions', 403);
        }

        next();
    };
};

// Example usage:
// router.get('/admin-only', 
//     authenticateToken, 
//     requireRole(['admin']), 
//     adminController
// ); 
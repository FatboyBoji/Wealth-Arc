import rateLimit from 'express-rate-limit';
import { Options } from 'express-rate-limit';

export const rateLimiter = (options?: Partial<Options>) => {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: {
            error: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later.',
        },
        ...options
    });
}; 
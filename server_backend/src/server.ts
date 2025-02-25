import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import csurf from 'csurf';
import expressSanitizer from 'express-sanitizer';
import authRoutes from './routes/auth';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { Logger } from './services/logger';
import sessionRoutes from './routes/sessions';
import { SessionManager } from './services/SessionManager';
import { trackSession } from './middleware/sessionTracking';
import { TokenService } from './config/auth';

// Extend Express Request type to include csrfToken
declare global {
    namespace Express {
        interface Request {
            csrfToken(): string;
        }
    }
}

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        // IP-based URLs
        'http://178.254.26.117',
        'http://178.254.26.117:45600',
        'http://178.254.26.117:3000',
        'http://178.254.26.117:45678',
        // Domain-based URLs
        'http://www.sesa-factory.eu',
        'http://www.sesa-factory.eu:45600',
        'http://www.sesa-factory.eu:45678',
        'http://sesa-factory.eu',
        'http://sesa-factory.eu:45600',
        'http://sesa-factory.eu:45678'
      ]
    : ['http://localhost:3000', 'http://localhost:3001'];

// CORS configuration
app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'CSRF-Token'],
    exposedHeaders: ['Access-Control-Allow-Origin']
}));

// Disable helmet's CORS-related features as we're handling CORS with the cors package
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(expressSanitizer());

// Cookie parser is required for CSRF
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to all routes
app.use(limiter);

// CSRF protection with updated configuration
const csrfProtection = csurf({
    cookie: {
        key: '_csrf',
        httpOnly: true,
        // secure: process.env.NODE_ENV === 'production',
        // sameSite: 'none', // Allow cross-origin cookies
        // domain: process.env.NODE_ENV === 'production' ? '178.254.26.117' : 'localhost'
        secure: false, // Allow HTTP for now
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Use 'lax' instead of 'none' for HTTP
        path: '/'
    }
});

// Apply CSRF protection selectively
app.use((req, res, next) => {
    // Skip CSRF for login, public routes, and OPTIONS requests
    if (req.method === 'OPTIONS' || req.path.startsWith('/api/auth/') || (req.method === 'GET' && !req.path.startsWith('/api/csrf-token'))) {
        next();
    } else {
        // Set CORS headers for CSRF cookie
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Origin', req.headers.origin || '');
        csrfProtection(req, res, next);
    }
});

// Provide CSRF token with proper headers
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    const token = req.csrfToken();
    res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        // secure: process.env.NODE_ENV === 'production',
        // sameSite: 'none',
        // domain: process.env.NODE_ENV === 'production' ? '178.254.26.117' : 'localhost',
        secure: false, // Allow HTTP for now
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Use 'lax' instead of 'none' for HTTP
        path: '/'
    });
    res.json({ csrfToken: token });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Add body parser error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
        console.error('JSON Parse Error:', err);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    next();
});

// Logging middleware
app.use(async (req, res, next) => {
    await Logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query,
        ip: req.ip
    });
    next();
});

// Error logging middleware
app.use(async (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    await Logger.error('Server error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    next(err);
});

// Error handling middleware - must have 4 parameters for Express to recognize it as error handler
const errorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        origin: req.headers.origin,
        method: req.method,
        path: req.path
    });

    // Handle CORS errors
    if (err.message === 'Not allowed by CORS') {
        res.status(403).json({
            error: 'CORS error',
            message: 'Origin not allowed'
        });
        return;
    }

    // Handle other errors
    res.status(500).json({ 
        error: 'Something broke!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

// Apply error handling middleware
app.use(errorHandler);

// Start session cleanup job
SessionManager.startCleanupJob();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    SessionManager.stopCleanupJob();
    // ... other cleanup code ...
});

// Add after auth middleware
app.use(trackSession);

// Start cleanup jobs
setInterval(async () => {
    await TokenService.cleanupExpiredSessions();
}, 1 * 60 * 1000); // Run every 1 minute

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
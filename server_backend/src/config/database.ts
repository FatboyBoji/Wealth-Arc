import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { Logger } from '../services/logger';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const config: PoolConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'sesa_news_db',
    // Add connection timeout settings
    connectionTimeoutMillis: 10000, // 10 seconds
    idleTimeoutMillis: 30000,      // 30 seconds
    max: 20,                       // Max 20 clients
    statement_timeout: 30000,      // 30 seconds
    query_timeout: 30000,          // 30 seconds
    // Connection pool settings
    maxUses: 7500,                   // Number of times a connection can be used before being closed
    application_name: 'sesa_news_backend',
    // Set schema based on environment
    options: `-c search_path=${process.env.NODE_ENV === 'production' ? 'u0155' : 'public'}`
};

// Custom rate limiter for login attempts
export class RateLimiter {
    private attempts: Map<string, { count: number, lastAttempt: number }> = new Map();
    private readonly maxAttempts: number = 5;
    private readonly windowMs: number = 15 * 60 * 1000; // 15 minutes
    private readonly blockDuration: number = 30 * 60 * 1000; // 30 minutes

    public checkRateLimit(identifier: string): boolean {
        const now = Date.now();
        const userAttempts = this.attempts.get(identifier);

        if (!userAttempts) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Reset attempts if window has passed
        if (now - userAttempts.lastAttempt > this.windowMs) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Check if user is blocked
        if (userAttempts.count >= this.maxAttempts) {
            const timeLeft = Math.ceil((this.blockDuration - (now - userAttempts.lastAttempt)) / 1000);
            if (timeLeft > 0) {
                throw new Error(`Too many login attempts. Please try again in ${timeLeft} seconds.`);
            }
            // Reset after block duration
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Increment attempts
        userAttempts.count += 1;
        userAttempts.lastAttempt = now;
        this.attempts.set(identifier, userAttempts);

        return true;
    }

    public clearAttempts(identifier: string): void {
        this.attempts.delete(identifier);
    }
}

class DatabasePool {
    private pool: Pool;
    private static instance: DatabasePool;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_DELAY = 5000; // 5 seconds

    private constructor() {
        this.pool = new Pool(config);
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.pool.on('error', (err) => {
            Logger.error('Unexpected database error', err);
            this.handleConnectionError(err);
        });

        this.pool.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            Logger.info('Database client connected', {
                timestamp: new Date().toISOString(),
                poolSize: this.pool.totalCount,
                idleCount: this.pool.idleCount
            });
        });
    }

    private async handleConnectionError(error: Error) {
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            Logger.warn('Database connection lost, attempting to reconnect', {
                attempt: this.reconnectAttempts,
                maxAttempts: this.MAX_RECONNECT_ATTEMPTS
            });

            await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
            
            try {
                await this.pool.connect();
            } catch (err) {
                Logger.error('Reconnection attempt failed', err);
            }
        } else {
            Logger.error('Max reconnection attempts reached', {
                attempts: this.reconnectAttempts
            });
            process.exit(1); // Exit if we can't reconnect
        }
    }

    public static getInstance(): DatabasePool {
        if (!DatabasePool.instance) {
            DatabasePool.instance = new DatabasePool();
        }
        return DatabasePool.instance;
    }

    public async query<T extends QueryResultRow = any>(
        text: string,
        params?: any[]
    ): Promise<QueryResult<T>> {
        const client = await this.pool.connect();
        try {
            const start = Date.now();
            const result = await client.query<T>(text, params);
            const duration = Date.now() - start;
            
            await Logger.debug('Executed query', {
                text,
                duration: `${duration}ms`,
                rows: result.rowCount
            });
            
            return result;
        } finally {
            client.release();
        }
    }

    public async end(): Promise<void> {
        await this.pool.end();
    }
}

export const query = async <T extends QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> => {
    return DatabasePool.getInstance().query<T>(text, params);
};

// General API rate limiting
export const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Export the custom rate limiter for login attempts
export const loginRateLimiter = new RateLimiter();
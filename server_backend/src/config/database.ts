import { Pool, PoolConfig, QueryResult } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const config: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5000'),
    database: process.env.DB_NAME || 'sesa_news_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    // Connection pool settings
    max: 20,                        // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,       // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000,  // How long to wait for a connection
    maxUses: 7500,                   // Number of times a connection can be used before being closed
    application_name: 'sesa_news_backend',
    // Set schema based on environment
    options: `-c search_path=${process.env.NODE_ENV === 'production' ? 'u0155' : 'public'}`
};

class DatabasePool {
    private pool: Pool;
    private retryCount: number = 0;
    private maxRetries: number = 5;
    private retryInterval: number = 5000;
    private isConnected: boolean = false;

    constructor() {
        this.pool = new Pool({
            ...config,
            max: 10,               // Maximum number of clients
            idleTimeoutMillis: 30000,  // How long a client is allowed to remain idle
            connectionTimeoutMillis: 2000,  // How long to wait for a connection
            maxUses: 7500,         // Number of times a connection can be used
            application_name: 'sesa_news_backend' // For better monitoring
        });
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        // Log when a client connects
        this.pool.on('connect', (client) => {
            this.isConnected = true;
            console.log('Database client connected:', {
                timestamp: new Date().toISOString(),
                poolSize: this.pool.totalCount,
                idleCount: this.pool.idleCount
            });
        });

        // Handle errors on the pool level
        this.pool.on('error', (err, client) => {
            this.isConnected = false;
            console.error('Unexpected error on idle client:', {
                error: err,
                timestamp: new Date().toISOString()
            });
            this.attemptReconnect();
        });

        // Handle when a client is removed
        this.pool.on('remove', (client) => {
            console.log('Database client removed:', {
                timestamp: new Date().toISOString(),
                poolSize: this.pool.totalCount,
                idleCount: this.pool.idleCount
            });
        });
    }

    private async attemptReconnect() {
        if (this.retryCount >= this.maxRetries) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.retryCount++;
        console.log(`Attempting to reconnect (attempt ${this.retryCount}/${this.maxRetries})`);

        try {
            // Try to end the current pool
            await this.pool.end();
        } catch (error) {
            console.error('Error ending pool:', error);
        }

        // Create a new pool
        this.pool = new Pool({
            ...config,
            max: 10,               // Maximum number of clients
            idleTimeoutMillis: 30000,  // How long a client is allowed to remain idle
            connectionTimeoutMillis: 2000,  // How long to wait for a connection
            maxUses: 7500,         // Number of times a connection can be used
            application_name: 'sesa_news_backend' // For better monitoring
        });
        this.setupEventHandlers();

        try {
            // Test the connection
            const client = await this.pool.connect();
            client.release();
            console.log('Successfully reconnected to database');
            this.retryCount = 0;
        } catch (error) {
            console.error('Reconnection failed:', error);
            // Schedule another retry
            setTimeout(() => this.attemptReconnect(), this.retryInterval);
        }
    }

    public async getConnection() {
        if (!this.isConnected) {
            try {
                const client = await this.pool.connect();
                client.release();
                this.isConnected = true;
            } catch (error) {
                console.error('Failed to get database connection:', error);
                throw error;
            }
        }
        return this.pool;
    }

    public async query(text: string, params?: any[]): Promise<QueryResult> {
        try {
            const pool = await this.getConnection();
            return await pool.query(text, params);
        } catch (error) {
            console.error('Database query error:', {
                error,
                query: text,
                params,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    private logPoolMetrics() {
        setInterval(() => {
            console.log('Database pool metrics:', {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount,
                timestamp: new Date().toISOString()
            });
        }, 60000); // Log every minute
    }
}

// Create and export a single instance
const databasePool = new DatabasePool();

// Export the query function
export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
    return databasePool.query(text, params);
};

// Export the pool instance directly if needed
export const pool = databasePool.getConnection();

// Export the DatabasePool class for type information
export { DatabasePool };

class RateLimiter {
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

// Export the rate limiter instance
export const rateLimiter = new RateLimiter();
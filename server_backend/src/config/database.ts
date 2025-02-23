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
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
    maxUses: 7500 // Number of times a connection can be used before being closed
};

class DatabasePool {
    private pool: Pool;
    private retryCount: number = 0;
    private maxRetries: number = 5;
    private retryInterval: number = 5000; // 5 seconds

    constructor() {
        this.pool = new Pool(config);
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        // Log when a client connects
        this.pool.on('connect', (client) => {
            console.log('New client connected to database');
        });

        // Handle errors on the pool level
        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
            this.attemptReconnect();
        });

        // Handle when a client is removed
        this.pool.on('remove', (client) => {
            console.log('Client removed from pool');
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
        this.pool = new Pool(config);
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

    public async query(text: string, params?: any[]) {
        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second

        while (retries < maxRetries) {
            try {
                return await this.pool.query(text, params);
            } catch (error: any) {
                if (error.code === 'ECONNREFUSED' || error.code === '57P01') {
                    retries++;
                    if (retries === maxRetries) {
                        throw error;
                    }
                    // Exponential backoff
                    const delay = baseDelay * Math.pow(2, retries - 1);
                    console.log(`Database query failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    public getPool() {
        return this.pool;
    }
}

// Create and export a single instance
export const db = new DatabasePool();
export const pool = db.getPool();

// Export a wrapped query function with retry logic
export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
    const result = await db.query(text, params);
    if (!result) {
        throw new Error('Query failed to return a result');
    }
    return result;
};
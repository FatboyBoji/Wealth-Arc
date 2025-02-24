import { Request } from 'express';
import fs from 'fs';
import path from 'path';

// Define log file paths
const LOG_DIR = path.join(process.cwd(), 'logs');
const SESSION_LOG = path.join(LOG_DIR, 'session.log');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');
const DEBUG_LOG = path.join(LOG_DIR, 'debug.log');
const AUTH_LOG = path.join(LOG_DIR, 'auth.log');
const JOBS_LOG = path.join(LOG_DIR, 'jobs.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface LogEntry {
    timestamp: string;
    message: string;
    data?: any;
    level: 'info' | 'error' | 'warn' | 'debug' | 'auth' | 'session' | 'jobs';
    source?: string;
}

export const Logger = {
    async write(entry: LogEntry, logFile: string): Promise<void> {
        const logEntry = JSON.stringify({
            ...entry,
            timestamp: new Date().toISOString()
        }, null, 2);

        try {
            await fs.promises.appendFile(logFile, `${logEntry}\n`);
            
            // Console logging in development
            if (process.env.NODE_ENV === 'development') {
                console.log(`[${entry.level.toUpperCase()}] ${entry.message}:`, entry.data);
            }
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    },

    // Add specific session logging
    async session(message: string, data?: any): Promise<void> {
        const sessionData = {
            ...data,
            timestamp: new Date().toISOString(),
            source: 'backend'
        };

        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data: sessionData,
            level: 'session'
        }, SESSION_LOG);

        // Log session termination attempts specially
        if (message.includes('termination')) {
            console.log('\n[Session Termination]', {
                message,
                ...sessionData
            });
        }
    },

    async info(message: string, data?: any): Promise<void> {
        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data,
            level: 'info'
        }, SESSION_LOG);
    },

    async error(message: string, error: any): Promise<void> {
        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data: error,
            level: 'error'
        }, ERROR_LOG);
    },

    async debug(message: string, data?: any): Promise<void> {
        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data,
            level: 'debug'
        }, DEBUG_LOG);
    },

    async warn(message: string, data?: any): Promise<void> {
        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data,
            level: 'warn'
        }, ERROR_LOG);
    },

    async auth(message: string, data?: any): Promise<void> {
        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data,
            level: 'auth'
        }, AUTH_LOG);
    },

    async jobs(message: string, data?: any): Promise<void> {
        await this.write({
            timestamp: new Date().toISOString(),
            message,
            data,
            level: 'jobs'
        }, JOBS_LOG);
    },

    request(req: Request, message: string): void {
        this.info(message, {
            method: req.method,
            path: req.path,
            ip: req.ip
        });
    }
};

export const logToFile = Logger.session.bind(Logger); 
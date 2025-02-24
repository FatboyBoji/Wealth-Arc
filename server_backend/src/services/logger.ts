import { Request } from 'express';

export const Logger = {
    auth: (message: string, data: any) => {
        console.log(`[Auth] ${message}:`, data);
    },
    error: (message: string, error: any) => {
        console.error(`[Error] ${message}:`, error);
    },
    warn: (message: string, data: any) => {
        console.warn(`[Warning] ${message}:`, data);
    },
    request: (req: Request, message: string) => {
        console.log(`[Request] ${message}:`, {
            method: req.method,
            path: req.path,
            ip: req.ip
        });
    },
    jobs: (message: string, data: any) => {
        console.log(`[Jobs] ${message}:`, data);
    }
}; 
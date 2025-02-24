import { CronJob } from 'cron';
import { TokenService } from '../config/auth';
import { Logger } from '../services/logger';

export const startTokenCleanupJob = (): void => {
    // Run every Sunday at 3 AM
    new CronJob('0 3 * * 0', async () => {
        try {
            Logger.jobs('Starting token cleanup job', { timestamp: new Date() });
            
            const result = await TokenService.cleanupExpiredTokens();
            
            Logger.jobs('Token cleanup completed', { 
                timestamp: new Date(),
                result 
            });
        } catch (error) {
            Logger.error('Token cleanup job failed', error);
        }
    }).start();
}; 
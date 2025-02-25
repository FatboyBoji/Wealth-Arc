import { Router } from 'express';
import { SessionManager } from '../services/SessionManager';
import { authenticateToken } from '../middleware/auth';
import { Logger } from '../services/logger';

const router = Router();

router.get('/metrics', authenticateToken, async (req, res) => {
    try {
        const metrics = await SessionManager.getMetrics();
        res.json(metrics);
    } catch (error) {
        Logger.error('Failed to fetch metrics', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/health', async (req, res) => {
    try {
        const health = await SessionManager.checkHealth();
        res.status(health.status === 'healthy' ? 200 : 503)
           .json(health);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Health check failed', error);
        res.status(500).json({ 
            status: 'unhealthy', 
            error: errorMessage 
        });
    }
});

export default router; 
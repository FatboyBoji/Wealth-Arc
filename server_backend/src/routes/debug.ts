import { Router } from 'express';
import { Logger } from '../services/logger';

const router = Router();

router.post('/debug-log', async (req, res) => {
    const { message, data } = req.body;
    await Logger.debug(message, data);
    res.json({ success: true });
});

export default router; 
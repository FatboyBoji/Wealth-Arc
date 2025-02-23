import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { TokenService } from '../config/auth';
import { authenticateUser } from '../services/auth';

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', { username, body: req.body });

        // Get device info from request headers
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString()
        };

        const result = await authenticateUser(
            username, 
            password, 
            JSON.stringify(deviceInfo)
        );

        if (result.success) {
            res.json(result);
        } else {
            res.status(401).json(result);
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        // Check if user already exists
        const existingUser = await UserModel.findByUsername(username);
        if (existingUser) {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }

        // Create new user
        const user = await UserModel.create({ username, password });

        // Generate token using TokenService instead of generateToken
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString()
        };

        const token = await TokenService.generateToken(user, JSON.stringify(deviceInfo));

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 
import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { generateToken } from '../config/auth';

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', { username, body: req.body });

        // Find user
        const user = await UserModel.findByUsername(username);
        console.log('User found:', { 
            userId: user?.id, 
            exists: !!user,
            userDetails: user ? {
                username: user.username,
                passwordHashLength: user.password_hash?.length,
                passwordHash: user.password_hash
            } : null
        });
        
        if (!user) {
            console.log('User not found');
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Verify password
        console.log('Attempting password verification with:', {
            providedPassword: password,
            storedHash: user.password_hash
        });
        const isValidPassword = await UserModel.verifyPassword(user, password);
        console.log('Password verification:', { isValid: isValidPassword });
        
        if (!isValidPassword) {
            console.log('Invalid password');
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Generate token
        const token = generateToken(user);
        console.log('Token generated successfully');

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
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

        // Generate token
        const token = generateToken(user);

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
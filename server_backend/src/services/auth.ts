import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { TokenService } from '../config/auth';

interface AuthResult {
    success: boolean;
    token?: string;
    user?: {
        id: number;
        username: string;
    };
    message?: string;
}

export async function authenticateUser(
    username: string, 
    password: string,
    deviceInfo?: string
): Promise<AuthResult> {
    try {
        console.log('Login attempt:', { username, timestamp: new Date().toISOString() });

        // Find user
        const userResult = await query(
            'SELECT id, username, password_hash FROM users WHERE username = $1',
            [username]
        );

        console.log('User lookup result:', {
            found: userResult.rows.length > 0,
            username,
            timestamp: new Date().toISOString()
        });

        if (userResult.rows.length === 0) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }

        const user = userResult.rows[0];

        // Verify password
        console.log('Attempting password verification:', {
            username,
            passwordLength: password.length,
            timestamp: new Date().toISOString()
        });

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        console.log('Password verification result:', {
            username,
            isValid: isValidPassword,
            timestamp: new Date().toISOString()
        });

        if (!isValidPassword) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }

        // Generate token with device info
        const token = await TokenService.generateToken(user, deviceInfo);

        console.log('Login successful:', {
            username,
            userId: user.id,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username
            }
        };
    } catch (error) {
        console.error('Authentication error:', {
            error,
            username,
            timestamp: new Date().toISOString()
        });
        throw new Error('Authentication failed');
    }
} 
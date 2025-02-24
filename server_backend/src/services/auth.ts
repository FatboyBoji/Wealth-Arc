import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { TokenService, MaxSessionsError, AUTH_CONFIG } from '../config/auth';
import { UserModel } from '../models/User';
import { DeviceInfo } from '../types/auth';
import { Logger } from '../services/logger';

interface AuthResult {
    success: boolean;
    token?: string;
    refreshToken?: string;
    user?: {
        id: number;
        username: string;
    };
    message?: string;
    error?: string;
}

export async function authenticateUser(
    username: string, 
    password: string,
    deviceInfo: DeviceInfo
): Promise<AuthResult> {
    console.log('Auth attempt with raw body:', {
        username,
        deviceInfoReceived: deviceInfo
    });

    try {
        console.log('Login attempt:', { 
            username, 
            deviceInfo,
            timestamp: new Date().toISOString() 
        });

        // Find user
        const user = await UserModel.findByUsername(username);
        
        // Log user lookup result
        console.log('User lookup result:', {
            found: !!user,
            username,
            timestamp: new Date().toISOString()
        });

        if (!user) {
            return { success: false, message: 'Invalid credentials' };
        }

        // Verify password
        console.log('Attempting password verification:', {
            username,
            passwordLength: password.length,
            timestamp: new Date().toISOString()
        });

        const isValid = await UserModel.verifyPassword(user, password);
        
        // Log password verification result
        console.log('Password verification result:', {
            username,
            isValid,
            timestamp: new Date().toISOString()
        });

        if (!isValid) {
            return { success: false, message: 'Invalid credentials' };
        }

        // Get active sessions before generating token
        const activeSessions = await TokenService.getActiveSessions(user.id);
        
        if (activeSessions.length >= AUTH_CONFIG.MAX_SESSIONS_PER_USER) {
            console.log('Max sessions reached:', {
                userId: user.id,
                sessionCount: activeSessions.length,
                userObject: user
            });
            
            // Create error with explicit userId
            const maxSessionsError = new MaxSessionsError(
                activeSessions.map(session => ({
                    ...session,
                    id: session.id.toString() // Ensure ID is string
                })), 
                user.id
            );
            
            // Verify error object
            console.log('MaxSessionsError created:', {
                errorName: maxSessionsError.name,
                sessions: maxSessionsError.sessions.length,
                userId: maxSessionsError.userId,
                hasUserId: 'userId' in maxSessionsError
            });
            
            throw maxSessionsError;
        }

        const { token, refreshToken } = await TokenService.generateTokens(user.id, deviceInfo);
        
        return {
            success: true,
            token,
            refreshToken,
            user: {
                id: user.id,
                username: user.username
            }
        };
    } catch (error) {
        if (error instanceof MaxSessionsError) {
            throw error; // Re-throw MaxSessionsError to be handled by controller
        }
        console.error('Auth error:', error);
        throw error;
    }
}

export async function logout(userId: number, tokenId: string): Promise<void> {
    try {
        await TokenService.logout(userId, tokenId);
    } catch (error) {
        Logger.error('Logout failed', { error, userId, tokenId });
        throw error;
    }
} 
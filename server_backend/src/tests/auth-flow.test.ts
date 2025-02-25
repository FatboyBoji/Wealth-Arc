import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { AuthService } from '../services/auth';
import { SessionManager, SessionInfo } from '../services/SessionManager';
import { DeviceInfo } from '../types/auth';
import { setupTestDb, cleanupTestDb } from './setup';
import { UserModel } from '../models/User';
import { UserRole } from '../types/user';
import { v4 as uuidv4 } from 'uuid';
import { closeDatabase } from '../config/database';
import { MaxSessionsError } from '../config/auth';
import { AUTH_CONFIG } from '../config/auth';

describe('Authentication Flow Tests', () => {
    const testDeviceInfo: DeviceInfo = {
        type: 'browser',
        os: 'test-os',
        browser: 'test-browser',
        name: 'test-device',
        ip: '127.0.0.1'
    };

    beforeAll(async () => {
        await setupTestDb();
    });

    afterAll(async () => {
        await cleanupTestDb();
        await closeDatabase();
    });

    beforeEach(async () => {
        await cleanupTestDb();
    });

    describe('Login', () => {
        test('successful login with valid credentials', async () => {
            // Create test user with unique email
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            const result = await AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            );
            
            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('sessionId');
        });

        test('fails with invalid credentials', async () => {
            const uniqueId = uuidv4();
            await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'correctpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            await expect(AuthService.login(
                `testuser_${uniqueId}`,
                'wrongpass',
                testDeviceInfo
            )).rejects.toThrow('Invalid credentials');
        });

        test('fails with inactive user', async () => {
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: false,
                is_email_verified: true
            });

            // Directly query the user to verify it's inactive
            const user = await UserModel.findByUsername(`testuser_${uniqueId}`);
            expect(user?.is_active).toBe(false);

            // Now try to login
            await expect(AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            )).rejects.toThrow('Invalid credentials');
        });

        test('enforces maximum sessions limit', async () => {
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            // Create MAX_SESSIONS_PER_USER sessions
            for (let i = 0; i < AUTH_CONFIG.MAX_SESSIONS_PER_USER; i++) {
                await AuthService.login(
                    `testuser_${uniqueId}`,
                    'testpass',
                    { ...testDeviceInfo, name: `device_${i}` }
                );
            }

            // Try to create one more session
            await expect(AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            )).rejects.toThrow(MaxSessionsError);
        });
    });

    describe('Session Management', () => {
        test('tracks session activity', async () => {
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            const loginResult = await AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            );

            // Verify session is tracked
            const sessions = await SessionManager.getUserSessions(testUser.id);
            expect(sessions.length).toBe(1);
            expect(sessions[0].token_id).toBe(loginResult.sessionId);
        });
    });

    test('Logout Flow', async () => {
        const uniqueId = uuidv4();
        const testUser = await UserModel.create({
            username: `testuser_${uniqueId}`,
            password: 'testpass',
            email: `test_${uniqueId}@example.com`,
            role: 'user' as UserRole,
            is_active: true,
            is_email_verified: true
        });

        const loginResult = await AuthService.login(
            `testuser_${uniqueId}`,
            'testpass',
            testDeviceInfo
        );

        // Get session ID from sessions table
        const sessions = await SessionManager.getUserSessions(testUser.id);
        expect(sessions.length).toBe(1);
        
        const result = await AuthService.logout(sessions[0].id, testUser.id);
        expect(result).toBe(true);
    });

    describe('Token Management', () => {
        test('refreshes access token', async () => {
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            const loginResult = await AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            );

            // Wait briefly to simulate token age
            await new Promise(resolve => setTimeout(resolve, 100));

            const refreshResult = await AuthService.refreshToken(loginResult.refreshToken);
            expect(refreshResult).toHaveProperty('token');
            expect(refreshResult).toHaveProperty('refreshToken');
            expect(refreshResult.token).not.toBe(loginResult.token);
        });

        test('revokes refresh token on logout', async () => {
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            const loginResult = await AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            );

            // Get session ID from sessions table
            const sessions = await SessionManager.getUserSessions(testUser.id);
            expect(sessions.length).toBe(1);
            
            await AuthService.logout(sessions[0].id, testUser.id);

            // Try to use the refresh token
            await expect(
                AuthService.refreshToken(loginResult.refreshToken)
            ).rejects.toThrow('Invalid refresh token');
        });
    });

    describe('Session Cleanup', () => {
        test('marks and cleans up inactive sessions', async () => {
            const uniqueId = uuidv4();
            const testUser = await UserModel.create({
                username: `testuser_${uniqueId}`,
                password: 'testpass',
                email: `test_${uniqueId}@example.com`,
                role: 'user' as UserRole,
                is_active: true,
                is_email_verified: true
            });

            const loginResult = await AuthService.login(
                `testuser_${uniqueId}`,
                'testpass',
                testDeviceInfo
            );

            // Get session ID from sessions table
            const sessions = await SessionManager.getUserSessions(testUser.id);
            expect(sessions.length).toBe(1);

            // Mark session for deletion
            await SessionManager.markSessionForDeletion(sessions[0].id, testUser.id);

            // Run cleanup
            const cleanupResult = await SessionManager.cleanup();
            expect(cleanupResult.markedSessions).toBeGreaterThan(0);

            // Verify session is gone
            const remainingSessions = await SessionManager.getUserSessions(testUser.id);
            expect(remainingSessions.length).toBe(0);
        });
    });
}); 
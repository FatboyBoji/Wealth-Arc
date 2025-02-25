import { query } from '../config/database';

export async function setupTestDb() {
    await query(`
        CREATE TABLE IF NOT EXISTS user_sessions_wa (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id INTEGER NOT NULL,
            token_id UUID NOT NULL,
            device_type VARCHAR(50),
            device_name VARCHAR(255),
            browser VARCHAR(255),
            os VARCHAR(255),
            last_active TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            is_marked_for_deletion BOOLEAN DEFAULT FALSE,
            marked_at TIMESTAMP,
            activity_count INTEGER DEFAULT 0,
            last_ip VARCHAR(45)
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens_wa (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            token_id UUID NOT NULL,
            user_id INTEGER NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            is_revoked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
}

export async function cleanupTestDb() {
    // Clean up test data but keep the tables
    await query(`
        DELETE FROM user_sessions_wa WHERE user_id IN (
            SELECT id FROM user_of_wa WHERE username LIKE 'testuser_%'
        );
        DELETE FROM refresh_tokens_wa WHERE user_id IN (
            SELECT id FROM user_of_wa WHERE username LIKE 'testuser_%'
        );
        DELETE FROM user_of_wa WHERE username LIKE 'testuser_%';
    `);
} 
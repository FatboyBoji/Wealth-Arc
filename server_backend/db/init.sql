-- Check if tables exist and drop them if necessary
DROP TABLE IF EXISTS news_updates;
DROP TABLE IF EXISTS users;

-- Set client encoding to UTF8
SET client_encoding = 'UTF8';

-- Users table for admin authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(60) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News/Updates table
CREATE TABLE news_updates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    version VARCHAR(50),
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop existing constraint if it exists
ALTER TABLE news_updates DROP CONSTRAINT IF EXISTS valid_type;

-- Add constraints for the type field with explicit encoding
DO $$ 
BEGIN 
    ALTER TABLE news_updates
    ADD CONSTRAINT valid_type CHECK (
        type = ANY (ARRAY['neuigkeiten', 'releases', 'frameworks', E'ank\u00FCndigungen'])
    );
END $$;

-- Create indexes for better performance
CREATE INDEX idx_news_type ON news_updates(type);
CREATE INDEX idx_news_published_at ON news_updates(published_at DESC);

-- Insert test admin user
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2b$10$reyuNS2BUwH0hdLmuSqaJ.rPkAlbpKPLd5iWwPGaymcqTn7lzG3i2');

-- Verify tables exist
\dt

-- Describe tables
\d users
\d news_updates 

-- Initialize database schema
CREATE SCHEMA IF NOT EXISTS public;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO PUBLIC;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Include other SQL files
\i 'create_test_user.sql'
\i 'migrations/create_sessions.sql'
\i 'migrations/create_refresh_tokens.sql'

-- Update references in other tables to point to user_of_wa
ALTER TABLE user_sessions_wa
    DROP CONSTRAINT user_sessions_wa_user_id_fkey,
    ADD CONSTRAINT user_sessions_wa_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_of_wa(id) ON DELETE CASCADE;

ALTER TABLE refresh_tokens
    DROP CONSTRAINT refresh_tokens_user_id_fkey,
    ADD CONSTRAINT refresh_tokens_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_of_wa(id) ON DELETE CASCADE;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC; 
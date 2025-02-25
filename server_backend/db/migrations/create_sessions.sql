-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table if it exists
DROP TABLE IF EXISTS user_sessions_wa CASCADE;

-- Create sessions table
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
    last_ip VARCHAR(45),
    CONSTRAINT fk_user_wa
        FOREIGN KEY(user_id)
        REFERENCES user_of_wa(id)
        ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_wa_user_id ON user_sessions_wa(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_wa_token_id ON user_sessions_wa(token_id);
CREATE INDEX IF NOT EXISTS idx_sessions_wa_last_active ON user_sessions_wa(last_active);
CREATE INDEX IF NOT EXISTS idx_sessions_wa_marked ON user_sessions_wa(is_marked_for_deletion) 
    WHERE is_marked_for_deletion = true;

-- Add comments for documentation
COMMENT ON TABLE user_sessions_wa IS 'Stores active user sessions for Wealth Arc';
COMMENT ON COLUMN user_sessions_wa.is_marked_for_deletion IS 'Flag indicating if session is marked for cleanup';
COMMENT ON COLUMN user_sessions_wa.marked_at IS 'Timestamp when session was marked for deletion';

-- Add comments
COMMENT ON TABLE user_sessions_wa IS 'Stores active user sessions';
COMMENT ON COLUMN user_sessions_wa.id IS 'Unique identifier for the session';
COMMENT ON COLUMN user_sessions_wa.user_id IS 'References the user_of_wa who owns this session';
COMMENT ON COLUMN user_sessions_wa.token_id IS 'UUID of the JWT token';
COMMENT ON COLUMN user_sessions_wa.device_type IS 'Type of device (mobile, desktop, etc)';
COMMENT ON COLUMN user_sessions_wa.device_name IS 'Name of the device';
COMMENT ON COLUMN user_sessions_wa.browser IS 'Browser used for the session';
COMMENT ON COLUMN user_sessions_wa.os IS 'Operating system of the device';
COMMENT ON COLUMN user_sessions_wa.last_active IS 'Last activity timestamp';
COMMENT ON COLUMN user_sessions_wa.created_at IS 'Timestamp when session was created';
COMMENT ON COLUMN user_sessions_wa.activity_count IS 'Count of activities in the session';
COMMENT ON COLUMN user_sessions_wa.last_ip IS 'Last IP address used for the session';


-- Drop existing table if it exists
DROP TABLE IF EXISTS user_sessions_wa CASCADE;

-- Create sessions table
CREATE TABLE user_sessions_wa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id UUID UNIQUE NOT NULL,
    device_type VARCHAR(50),
    device_os VARCHAR(50),
    device_browser VARCHAR(50),
    friendly_name VARCHAR(100),
    ip_address VARCHAR(45),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, token_id)
);

-- Add indexes
CREATE INDEX idx_sessions_user ON user_sessions_wa(user_id);
CREATE INDEX idx_sessions_token ON user_sessions_wa(token_id);
CREATE INDEX idx_sessions_last_active ON user_sessions_wa(last_active);

-- Add comments
COMMENT ON TABLE user_sessions_wa IS 'Stores active user sessions';
COMMENT ON COLUMN user_sessions_wa.id IS 'Unique identifier for the session';
COMMENT ON COLUMN user_sessions_wa.user_id IS 'References the user who owns this session';
COMMENT ON COLUMN user_sessions_wa.token_id IS 'UUID of the JWT token';
COMMENT ON COLUMN user_sessions_wa.device_type IS 'Type of device (mobile, desktop, etc)';
COMMENT ON COLUMN user_sessions_wa.device_os IS 'Operating system of the device';
COMMENT ON COLUMN user_sessions_wa.device_browser IS 'Browser used for the session';
COMMENT ON COLUMN user_sessions_wa.friendly_name IS 'Human-readable device name';
COMMENT ON COLUMN user_sessions_wa.ip_address IS 'IP address of the client';
COMMENT ON COLUMN user_sessions_wa.last_active IS 'Last activity timestamp'; 
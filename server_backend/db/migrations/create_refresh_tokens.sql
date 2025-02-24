-- Drop existing table and indexes if they exist
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP INDEX IF EXISTS idx_refresh_tokens_user;
DROP INDEX IF EXISTS idx_refresh_tokens_expires;

-- Create refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, token_id) REFERENCES user_sessions_wa(user_id, token_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token_id);

-- Add comments for documentation
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for user session management';
COMMENT ON COLUMN refresh_tokens.id IS 'Unique identifier for the refresh token';
COMMENT ON COLUMN refresh_tokens.user_id IS 'References the user who owns this token';
COMMENT ON COLUMN refresh_tokens.token_id IS 'References the associated session token';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'When this refresh token expires';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Whether this token has been manually revoked'; 
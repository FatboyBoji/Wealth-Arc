-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table if it exists
DROP TABLE IF EXISTS refresh_tokens_wa CASCADE;

CREATE TABLE IF NOT EXISTS refresh_tokens_wa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_user_wa
        FOREIGN KEY(user_id)
        REFERENCES user_of_wa(id)
        ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_wa_user_id ON refresh_tokens_wa(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_wa_token_id ON refresh_tokens_wa(token_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_wa_expires_at ON refresh_tokens_wa(expires_at);

-- Add comments
COMMENT ON TABLE refresh_tokens_wa IS 'Stores refresh tokens for Wealth Arc user sessions';
COMMENT ON COLUMN refresh_tokens_wa.id IS 'Unique identifier for the refresh token';
COMMENT ON COLUMN refresh_tokens_wa.token_id IS 'UUID of the associated session token';
COMMENT ON COLUMN refresh_tokens_wa.user_id IS 'References the user_of_wa who owns this token';
COMMENT ON COLUMN refresh_tokens_wa.expires_at IS 'Expiration timestamp';
COMMENT ON COLUMN refresh_tokens_wa.is_revoked IS 'Whether the token has been revoked';
COMMENT ON COLUMN refresh_tokens_wa.created_at IS 'Creation timestamp'; 
-- Drop existing tables if they exist
DROP TABLE IF EXISTS user_of_wa CASCADE;
DROP TYPE IF EXISTS user_role_enum CASCADE;

-- Create user role enum
CREATE TYPE user_role_enum AS ENUM ('admin', 'user', 'manager', 'readonly');

-- Create users table
CREATE TABLE user_of_wa (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    role user_role_enum DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES user_of_wa(id),
    FOREIGN KEY (updated_by) REFERENCES user_of_wa(id)
);

-- Add indexes
CREATE INDEX idx_user_username ON user_of_wa(username);
CREATE INDEX idx_user_email ON user_of_wa(email);
CREATE INDEX idx_user_role ON user_of_wa(role);
CREATE INDEX idx_user_active ON user_of_wa(is_active);

-- Add comments
COMMENT ON TABLE user_of_wa IS 'Stores user account information for Wealth Arc application';
COMMENT ON COLUMN user_of_wa.id IS 'Unique identifier for the user';
COMMENT ON COLUMN user_of_wa.username IS 'Unique username for login';
COMMENT ON COLUMN user_of_wa.email IS 'Unique email address for user contact and verification';
COMMENT ON COLUMN user_of_wa.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN user_of_wa.first_name IS 'User''s first name';
COMMENT ON COLUMN user_of_wa.last_name IS 'User''s last name';
COMMENT ON COLUMN user_of_wa.role IS 'User role for permission management';
COMMENT ON COLUMN user_of_wa.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN user_of_wa.is_email_verified IS 'Whether the email has been verified';
COMMENT ON COLUMN user_of_wa.last_login IS 'Timestamp of last successful login';
COMMENT ON COLUMN user_of_wa.failed_login_attempts IS 'Count of consecutive failed login attempts';
COMMENT ON COLUMN user_of_wa.created_at IS 'Timestamp when the user was created';
COMMENT ON COLUMN user_of_wa.updated_at IS 'Timestamp when the user was last updated';
COMMENT ON COLUMN user_of_wa.created_by IS 'Reference to the user who created this account';
COMMENT ON COLUMN user_of_wa.updated_by IS 'Reference to the user who last updated this account';

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_user_modtime
    BEFORE UPDATE ON user_of_wa
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial admin user
INSERT INTO user_of_wa (
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    is_email_verified
) VALUES (
    'admin',
    'admin@wealtharc.com',
    '$2b$10$reyuNS2BUwH0hdLmuSqaJ.rPkAlbpKPLd5iWwPGaymcqTn7lzG3i2', -- password: admin123
    'System',
    'Administrator',
    'admin',
    true,
    true
); 
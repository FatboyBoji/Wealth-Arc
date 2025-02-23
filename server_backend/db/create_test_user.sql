-- Insert test admin user
INSERT INTO users (username, password_hash)
VALUES ('admin', '$2b$10$reyuNS2BUwH0hdLmuSqaJ.rPkAlbpKPLd5iWwPGaymcqTn7lzG3i2');

-- Verify the user was created
SELECT id, username, created_at FROM users WHERE username = 'admin'; 
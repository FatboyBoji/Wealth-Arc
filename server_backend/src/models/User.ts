import { query } from '../config/database';
import bcrypt from 'bcrypt';
import { Logger } from '../services/logger';
import { ValidationError } from '../services/errors';
import { UserOfWA, UserCreateInput, UserUpdateInput, UserRole } from '../types/user';

export class UserModel {
    private static readonly SALT_ROUNDS = 10;

    private static validateInput(input: UserCreateInput): void {
        const errors: string[] = [];

        if (!input.username?.trim()) {
            errors.push('Username is required');
        } else if (input.username.length < 3) {
            errors.push('Username must be at least 3 characters long');
        }

        if (!input.email?.trim()) {
            errors.push('Email is required');
        } else if (!this.isValidEmail(input.email)) {
            errors.push('Invalid email format');
        }

        if (!input.password) {
            errors.push('Password is required');
        }

        if (errors.length > 0) {
            throw new ValidationError(errors.join(', '));
        }
    }

    private static isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    private static sanitizeInput(input: string): string {
        return input.trim().toLowerCase();
    }

    static async create(input: UserCreateInput): Promise<UserOfWA> {
        this.validateInput(input);

        const sanitizedUsername = this.sanitizeInput(input.username);
        const sanitizedEmail = this.sanitizeInput(input.email);

        try {
            // Check for existing user
            const existingUser = await this.findByUsername(sanitizedUsername);
            if (existingUser) {
                throw new ValidationError('Username already exists');
            }

            const existingEmail = await this.findByEmail(sanitizedEmail);
            if (existingEmail) {
                throw new ValidationError('Email already exists');
            }

            const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

            const result = await query<UserOfWA>(
                `INSERT INTO user_of_wa (
                    username, email, password_hash, first_name, last_name, 
                    role, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
                [
                    sanitizedUsername,
                    sanitizedEmail,
                    passwordHash,
                    input.first_name,
                    input.last_name,
                    input.role || 'user',
                    input.created_by
                ]
            );

            const user = result.rows[0];

            Logger.auth('User created', {
                userId: user.id,
                username: user.username,
                role: user.role,
                action: 'CREATE'
            });

            return user;
        } catch (error) {
            Logger.error('Failed to create user', error);
            throw error;
        }
    }

    static async findById(id: number): Promise<UserOfWA | null> {
        try {
            const result = await query<UserOfWA>(
                'SELECT * FROM user_of_wa WHERE id = $1 AND is_active = true',
                [id]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Failed to find user by ID', error);
            throw error;
        }
    }

    static async findByUsername(username: string): Promise<UserOfWA | null> {
        try {
            const sanitizedUsername = this.sanitizeInput(username);
            const result = await query<UserOfWA>(
                'SELECT * FROM user_of_wa WHERE username = $1',
                [sanitizedUsername]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Failed to find user by username', error);
            throw error;
        }
    }

    static async findByEmail(email: string): Promise<UserOfWA | null> {
        try {
            const sanitizedEmail = this.sanitizeInput(email);
            const result = await query<UserOfWA>(
                'SELECT * FROM user_of_wa WHERE email = $1',
                [sanitizedEmail]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Failed to find user by email', error);
            throw error;
        }
    }

    static async updateLastLogin(id: number): Promise<void> {
        try {
            await query(
                `UPDATE user_of_wa 
                 SET last_login = NOW(), 
                     failed_login_attempts = 0
                 WHERE id = $1`,
                [id]
            );

            Logger.auth('User login updated', {
                userId: id,
                action: 'UPDATE_LOGIN'
            });
        } catch (error) {
            Logger.error('Failed to update last login', error);
            throw error;
        }
    }

    static async incrementFailedLogin(id: number): Promise<number> {
        try {
            const result = await query<{ failed_login_attempts: number }>(
                `UPDATE user_of_wa 
                 SET failed_login_attempts = failed_login_attempts + 1
                 WHERE id = $1
                 RETURNING failed_login_attempts`,
                [id]
            );
            return result.rows[0].failed_login_attempts;
        } catch (error) {
            Logger.error('Failed to increment failed login attempts', error);
            throw error;
        }
    }

    static async verifyPassword(user: UserOfWA, password: string): Promise<boolean> {
        try {
            return await bcrypt.compare(password, user.password_hash);
        } catch (error) {
            Logger.error('Password verification failed', error);
            throw error;
        }
    }

    static async update(id: number, input: UserUpdateInput): Promise<UserOfWA> {
        try {
            const result = await query<UserOfWA>(
                `UPDATE user_of_wa 
                 SET email = COALESCE($1, email),
                     first_name = COALESCE($2, first_name),
                     last_name = COALESCE($3, last_name),
                     role = COALESCE($3, role),
                     is_active = COALESCE($4, is_active),
                     updated_by = $5,
                     updated_at = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [
                    input.email,
                    input.first_name,
                    input.last_name,
                    input.role,
                    input.is_active,
                    input.updated_by,
                    id
                ]
            );

            if (!result.rows[0]) {
                throw new ValidationError('User not found');
            }

            Logger.auth('User updated', {
                userId: id,
                updatedBy: input.updated_by,
                action: 'UPDATE'
            });

            return result.rows[0];
        } catch (error) {
            Logger.error('Failed to update user', error);
            throw error;
        }
    }
} 
import { pool } from '../config/database';
import bcrypt from 'bcrypt';

export interface User {
    id: number;
    username: string;
    password_hash: string;
    created_at: Date;
}

export interface UserCreate {
    username: string;
    password: string;
}

export class UserModel {
    static async create({ username, password }: UserCreate): Promise<User> {
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
            [username, password_hash]
        );
        return result.rows[0];
    }

    static async findByUsername(username: string): Promise<User | null> {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0] || null;
    }

    static async verifyPassword(user: User, password: string): Promise<boolean> {
        console.log('Verifying password:', {
            userPasswordHash: user.password_hash,
            passwordLength: password.length
        });
        return bcrypt.compare(password, user.password_hash);
    }

    static async findById(id: number): Promise<User | null> {
        const result = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
} 
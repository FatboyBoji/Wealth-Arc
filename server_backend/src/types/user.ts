export type UserRole = 'admin' | 'user' | 'manager' | 'readonly';

export interface UserOfWA {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    first_name?: string;
    last_name?: string;
    role: UserRole;
    is_active: boolean;
    is_email_verified: boolean;
    last_login?: Date;
    failed_login_attempts: number;
    created_at: Date;
    updated_at: Date;
    created_by?: number;
    updated_by?: number;
}

export interface UserCreateInput {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: UserRole;
    created_by?: number;
}

export interface UserUpdateInput {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: UserRole;
    is_active?: boolean;
    updated_by: number;
}

export interface UserResponse {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role: UserRole;
    is_active: boolean;
    is_email_verified: boolean;
    last_login?: Date;
} 
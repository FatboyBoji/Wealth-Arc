export class AppError extends Error {
    constructor(
        message: string,
        public status: number = 400,
        public code: string = 'APP_ERROR'
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class AuthError extends AppError {
    constructor(
        message: string,
        status: number = 401,
        code: string = 'AUTH_ERROR'
    ) {
        super(message, status, code);
    }
}

export class ValidationError extends AppError {
    constructor(
        message: string,
        status: number = 400,
        code: string = 'VALIDATION_ERROR'
    ) {
        super(message, status, code);
    }
}

// Update MaxSessionsError to extend AppError
export class MaxSessionsError extends AppError {
    constructor(
        public sessions: any[],
        public userId: number
    ) {
        super('Maximum number of sessions reached', 400, 'MAX_SESSIONS_ERROR');
        
        if (typeof userId !== 'number') {
            throw new Error('Invalid userId provided to MaxSessionsError');
        }
    }
} 
export class SessionError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'SessionError';
    }
}

export class MaxSessionsError extends SessionError {
    constructor() {
        super('Maximum number of sessions reached', 'MAX_SESSIONS');
    }
} 
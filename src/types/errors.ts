import { DeviceSession } from './sessions';

export class MaxSessionsError extends Error {
    constructor(
        public sessions: DeviceSession[],
        public userId: number,
        message: string
    ) {
        super(message);
        this.name = 'MaxSessionsError';
    }
} 
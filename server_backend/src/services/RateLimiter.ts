export class RateLimiter {
    private attempts: Map<string, { count: number, lastAttempt: number }> = new Map();
    private readonly maxAttempts: number = 5;
    private readonly windowMs: number = 15 * 60 * 1000; // 15 minutes
    private readonly blockDuration: number = 30 * 60 * 1000; // 30 minutes

    public checkRateLimit(identifier: string): boolean {
        const now = Date.now();
        const userAttempts = this.attempts.get(identifier);

        if (!userAttempts) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Reset attempts if window has passed
        if (now - userAttempts.lastAttempt > this.windowMs) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Check if user is blocked
        if (userAttempts.count >= this.maxAttempts) {
            const timeLeft = Math.ceil((this.blockDuration - (now - userAttempts.lastAttempt)) / 1000);
            if (timeLeft > 0) {
                throw new Error(`Too many login attempts. Please try again in ${timeLeft} seconds.`);
            }
            // Reset after block duration
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Increment attempts
        userAttempts.count += 1;
        userAttempts.lastAttempt = now;
        this.attempts.set(identifier, userAttempts);

        return true;
    }

    public clearAttempts(identifier: string): void {
        this.attempts.delete(identifier);
    }
} 
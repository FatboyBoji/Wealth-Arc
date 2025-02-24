export interface PasswordRequirements {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxLength: number;
}

export class PasswordPolicyService {
    private static readonly DEFAULT_REQUIREMENTS: PasswordRequirements = {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxLength: 128
    };

    static validatePassword(password: string, requirements = this.DEFAULT_REQUIREMENTS): string[] {
        const errors: string[] = [];

        if (password.length < requirements.minLength) {
            errors.push(`Password must be at least ${requirements.minLength} characters long`);
        }

        if (password.length > requirements.maxLength) {
            errors.push(`Password must not exceed ${requirements.maxLength} characters`);
        }

        if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (requirements.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (requirements.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (requirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Check for common patterns
        if (/(.)\1{2,}/.test(password)) {
            errors.push('Password must not contain repeating characters (3 or more times)');
        }

        if (/^(123|abc|qwe|password|admin)/i.test(password)) {
            errors.push('Password contains common patterns');
        }

        return errors;
    }

    static generatePasswordRequirementsMessage(): string {
        return `Password must:
            - Be ${this.DEFAULT_REQUIREMENTS.minLength}-${this.DEFAULT_REQUIREMENTS.maxLength} characters long
            - Contain uppercase and lowercase letters
            - Contain at least one number
            - Contain at least one special character
            - Not contain common patterns or repeating characters`;
    }
} 
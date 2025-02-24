import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body } from 'express-validator';
import { RequestHandler } from 'express';
import { UserRole } from '../types/user';

// Validation middleware
export const validate = (validations: ValidationChain[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            next();
            return;
        }

        res.status(400).json({
            error: 'VALIDATION_ERROR',
            errors: errors.array().map(err => ({
                field: err.type === 'field' ? err.path : err.type,
                message: err.msg
            }))
        });
    };
};

// Common validation rules
export const ValidationRules = {
    username: () => 
        body('username')
            .trim()
            .notEmpty().withMessage('Username is required')
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
            .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),

    email: () =>
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail(),

    password: () =>
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
            .matches(/[0-9]/).withMessage('Password must contain at least one number')
            .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),

    firstName: () =>
        body('first_name')
            .optional()
            .trim()
            .isLength({ min: 2 }).withMessage('First name must be at least 2 characters long')
            .matches(/^[a-zA-Z\s-]+$/).withMessage('First name can only contain letters, spaces, and hyphens'),

    lastName: () =>
        body('last_name')
            .optional()
            .trim()
            .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters long')
            .matches(/^[a-zA-Z\s-]+$/).withMessage('Last name can only contain letters, spaces, and hyphens'),

    role: () =>
        body('role')
            .optional()
            .isIn(['admin', 'user', 'manager', 'readonly'] as UserRole[])
            .withMessage('Invalid role'),

    deviceInfo: () =>
        body('deviceInfo').custom((value) => {
            if (!value || typeof value !== 'object') {
                throw new Error('Device information is required');
            }
            if (!value.type || !value.os || !value.browser) {
                throw new Error('Incomplete device information');
            }
            return true;
        })
};

// Common validation messages
export const ValidationMessages = {
    required: (field: string) => `${field} is required`,
    minLength: (field: string, min: number) => `${field} must be at least ${min} characters long`,
    maxLength: (field: string, max: number) => `${field} cannot exceed ${max} characters`,
    invalid: (field: string) => `Invalid ${field.toLowerCase()}`,
    exists: (field: string) => `${field} already exists`,
    notFound: (field: string) => `${field} not found`,
    invalidEnum: (field: string, values: string[]) => 
        `${field} must be one of: ${values.join(', ')}`
};

export const validatePreLoginTermination: ValidationChain[] = [
    body('username')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Username'))
        .isLength({ max: 50 }).withMessage(ValidationMessages.maxLength('Username', 50)),
    
    body('sessionId')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Session ID'))
        .isNumeric().withMessage(ValidationMessages.invalid('Session ID')),
    
    body('deviceInfo')
        .optional()
        .isObject().withMessage(ValidationMessages.invalid('Device info'))
]; 
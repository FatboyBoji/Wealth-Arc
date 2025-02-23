import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { RequestHandler } from 'express';

// Validation middleware
export const validate = (validations: ValidationChain[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            next();
            return;
        }

        res.status(400).json({
            errors: errors.array().map(err => ({
                field: err.type === 'field' ? err.path : err.type,
                message: err.msg
            }))
        });
    };
};

// Common validation error messages
export const ValidationMessages = {
    required: (field: string) => `${field} is required`,
    minLength: (field: string, min: number) => `${field} must be at least ${min} characters long`,
    maxLength: (field: string, max: number) => `${field} must not exceed ${max} characters`,
    invalid: (field: string) => `Invalid ${field}`,
    exists: (field: string) => `${field} already exists`,
    notFound: (field: string) => `${field} not found`,
    invalidEnum: (field: string, values: string[]) => 
        `${field} must be one of: ${values.join(', ')}`
}; 
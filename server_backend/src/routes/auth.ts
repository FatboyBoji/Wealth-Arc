import { Router } from 'express';
import { body } from 'express-validator';
import { login, register } from '../controllers/auth';
import { validate, ValidationMessages } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Validation rules
const loginValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Username'))
        .isLength({ min: 3 }).withMessage(ValidationMessages.minLength('Username', 3)),
    body('password')
        .notEmpty().withMessage(ValidationMessages.required('Password'))
];

const registerValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Username'))
        .isLength({ min: 3 }).withMessage(ValidationMessages.minLength('Username', 3))
        .isLength({ max: 50 }).withMessage(ValidationMessages.maxLength('Username', 50))
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .notEmpty().withMessage(ValidationMessages.required('Password'))
        .isLength({ min: 6 }).withMessage(ValidationMessages.minLength('Password', 6))
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
];

// Routes
router.post('/login', validate(loginValidation), login);
router.post('/register', validate(registerValidation), register);
router.get('/verify', authenticateToken, (req, res) => {
    res.status(200).json({ valid: true });
});

export default router; 
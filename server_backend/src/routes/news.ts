import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { validate, ValidationMessages } from '../middleware/validation';
import {
    getAllNews,
    getNewsById,
    createNews,
    updateNews,
    deleteNews
} from '../controllers/news';

const router = Router();

// Validation rules
const newsTypes = ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'];

const typeValidation = [
    query('type')
        .optional()
        .isIn(newsTypes)
        .withMessage(ValidationMessages.invalidEnum('Type', newsTypes))
];

const newsValidation = [
    body('title')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Title'))
        .isLength({ max: 255 }).withMessage(ValidationMessages.maxLength('Title', 255)),
    body('content')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Content')),
    body('type')
        .trim()
        .notEmpty().withMessage(ValidationMessages.required('Type'))
        .isIn(newsTypes)
        .withMessage(ValidationMessages.invalidEnum('Type', newsTypes)),
    body('version')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage(ValidationMessages.maxLength('Version', 50))
];

const idValidation = [
    param('id')
        .isInt().withMessage('Invalid ID format')
        .toInt()
];

// Public routes
router.get('/', validate(typeValidation), getAllNews);
router.get('/:id', validate(idValidation), getNewsById);

// Protected routes
router.post('/', authenticateToken, validate(newsValidation), createNews);
router.put('/:id', authenticateToken, validate([...idValidation, ...newsValidation]), updateNews);
router.delete('/:id', authenticateToken, validate(idValidation), deleteNews);

export default router; 
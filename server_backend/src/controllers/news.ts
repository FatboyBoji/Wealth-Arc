import { Request, Response } from 'express';
import { NewsUpdateModel, NewsType } from '../models/NewsUpdate';

// Custom error class for news-related errors
class NewsError extends Error {
    constructor(
        message: string,
        public status: number = 400,
        public code: string = 'NEWS_ERROR'
    ) {
        super(message);
        this.name = 'NewsError';
    }
}

// Get all news updates with optional type filter
export const getAllNews = async (req: Request, res: Response): Promise<void> => {
    try {
        const type = req.query.type as NewsType | undefined;
        const news = type ? await NewsUpdateModel.findByType(type) : await NewsUpdateModel.findAll();
        
        res.json({
            status: 'success',
            data: news
        });
    } catch (error) {
        console.error('Error fetching news:', error);
        throw new NewsError('Failed to fetch news updates', 500, 'FETCH_ERROR');
    }
};

// Get news update by ID
export const getNewsById = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new NewsError('Invalid news ID format', 400, 'INVALID_ID');
        }

        const news = await NewsUpdateModel.findById(id);
        if (!news) {
            throw new NewsError('News update not found', 404, 'NOT_FOUND');
        }

        res.json({
            status: 'success',
            data: news
        });
    } catch (error) {
        if (error instanceof NewsError) throw error;
        console.error('Error fetching news by ID:', error);
        throw new NewsError('Failed to fetch news update', 500, 'FETCH_ERROR');
    }
};

// Create new news update
export const createNews = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, content, type, version, published_at } = req.body;
        
        // Detailed logging
        console.log('Creating news with data:', {
            title,
            contentLength: content?.length,
            type,
            version,
            published_at,
            typeType: typeof type,
            validTypes: ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen']
        });
        
        // Type validation
        const validTypes = ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'];
        if (!validTypes.includes(type)) {
            throw new NewsError(
                `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`,
                400,
                'INVALID_TYPE'
            );
        }
        
        // Validate published_at if provided
        let parsedPublishedAt: Date | undefined;
        if (published_at) {
            parsedPublishedAt = new Date(published_at);
            if (isNaN(parsedPublishedAt.getTime())) {
                throw new NewsError('Invalid published_at date format', 400, 'INVALID_DATE');
            }
        }
        
        // Sanitize inputs
        const sanitizedTitle = (req as any).sanitize(title);
        const sanitizedContent = (req as any).sanitize(content);
        
        const news = await NewsUpdateModel.create({
            title: sanitizedTitle,
            content: sanitizedContent,
            type: type as NewsType,
            version: version ? (req as any).sanitize(version) : undefined,
            published_at: parsedPublishedAt
        });

        res.status(201).json({
            status: 'success',
            data: news
        });
    } catch (error) {
        console.error('Error creating news:', error);
        if (error instanceof NewsError) throw error;
        throw new NewsError(
            `Failed to create news update: ${error instanceof Error ? error.message : 'Unknown error'}`,
            500,
            'CREATE_ERROR'
        );
    }
};

// Update news update
export const updateNews = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new NewsError('Invalid news ID format', 400, 'INVALID_ID');
        }

        const { title, content, type, version, published_at } = req.body;
        
        // Validate published_at if provided
        let parsedPublishedAt: Date | undefined;
        if (published_at) {
            parsedPublishedAt = new Date(published_at);
            if (isNaN(parsedPublishedAt.getTime())) {
                throw new NewsError('Invalid published_at date format', 400, 'INVALID_DATE');
            }
        }
        
        // Sanitize inputs
        const updates = {
            ...(title && { title: (req as any).sanitize(title) }),
            ...(content && { content: (req as any).sanitize(content) }),
            ...(type && { type: type as NewsType }),
            ...(version && { version: (req as any).sanitize(version) }),
            ...(parsedPublishedAt && { published_at: parsedPublishedAt })
        };
        
        const news = await NewsUpdateModel.update(id, updates);
        if (!news) {
            throw new NewsError('News update not found', 404, 'NOT_FOUND');
        }

        res.json({
            status: 'success',
            data: news
        });
    } catch (error) {
        if (error instanceof NewsError) throw error;
        console.error('Error updating news:', error);
        throw new NewsError('Failed to update news update', 500, 'UPDATE_ERROR');
    }
};

// Delete news update
export const deleteNews = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new NewsError('Invalid news ID format', 400, 'INVALID_ID');
        }

        const deleted = await NewsUpdateModel.delete(id);
        if (!deleted) {
            throw new NewsError('News update not found', 404, 'NOT_FOUND');
        }

        res.status(204).send();
    } catch (error) {
        if (error instanceof NewsError) throw error;
        console.error('Error deleting news:', error);
        throw new NewsError('Failed to delete news update', 500, 'DELETE_ERROR');
    }
}; 
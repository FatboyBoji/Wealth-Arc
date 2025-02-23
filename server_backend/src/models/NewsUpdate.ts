import { pool, query } from '../config/database';

export type NewsType = 'neuigkeiten' | 'releases' | 'frameworks' | 'ankündigungen';

export interface NewsUpdate {
    id: number;
    title: string;
    content: string;
    type: NewsType;
    version?: string;
    published_at: Date;
    updated_at: Date;
}

export interface NewsUpdateCreate {
    title: string;
    content: string;
    type: NewsType;
    version?: string;
    published_at?: Date;
}

export class NewsUpdateModel {
    static async create(news: NewsUpdateCreate): Promise<NewsUpdate> {
        // Debug logging
        console.log('Creating news with exact values:', {
            title: news.title,
            content: news.content,
            type: news.type,
            version: news.version,
            published_at: news.published_at,
            typeExactValue: `'${news.type}'`, // Show exact string with quotes
            validTypes: ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'],
            isTypeValid: ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'].includes(news.type),
            typeLength: news.type.length,
            typeCharCodes: Array.from(news.type).map(char => char.charCodeAt(0))
        });

        // Validate type before sending to database
        if (!['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'].includes(news.type)) {
            throw new Error(`Invalid type: ${news.type}. Must be one of: neuigkeiten, releases, frameworks, ankündigungen`);
        }

        // Normalize the type string to ensure consistent encoding
        const normalizedType = news.type === 'ankündigungen' 
            ? 'ank\u00FCndigungen'  // Use the same encoding as in the database
            : news.type;

        const result = await query(
            `INSERT INTO news_updates (title, content, type, version, published_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [news.title, news.content, normalizedType, news.version, news.published_at || new Date()]
        );
        return result.rows[0];
    }

    static async findAll(): Promise<NewsUpdate[]> {
        const result = await query(
            'SELECT * FROM news_updates ORDER BY published_at DESC'
        );
        return result.rows;
    }

    static async findById(id: number): Promise<NewsUpdate | null> {
        const result = await query(
            'SELECT * FROM news_updates WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    static async findByType(type: NewsType): Promise<NewsUpdate[]> {
        const result = await query(
            'SELECT * FROM news_updates WHERE type = $1 ORDER BY published_at DESC',
            [type]
        );
        return result.rows;
    }

    static async update(id: number, news: Partial<NewsUpdateCreate>): Promise<NewsUpdate | null> {
        const existingNews = await this.findById(id);
        if (!existingNews) return null;

        const updates: string[] = [];
        const values: any[] = [];
        let valueCount = 1;

        if (news.title) {
            updates.push(`title = $${valueCount}`);
            values.push(news.title);
            valueCount++;
        }
        if (news.content) {
            updates.push(`content = $${valueCount}`);
            values.push(news.content);
            valueCount++;
        }
        if (news.type) {
            updates.push(`type = $${valueCount}`);
            values.push(news.type);
            valueCount++;
        }
        if (news.version !== undefined) {
            updates.push(`version = $${valueCount}`);
            values.push(news.version);
            valueCount++;
        }
        if (news.published_at) {
            updates.push(`published_at = $${valueCount}`);
            values.push(news.published_at);
            valueCount++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        const result = await query(
            `UPDATE news_updates 
             SET ${updates.join(', ')}
             WHERE id = $${valueCount}
             RETURNING *`,
            [...values, id]
        );
        return result.rows[0];
    }

    static async delete(id: number): Promise<boolean> {
        const result = await query(
            'DELETE FROM news_updates WHERE id = $1 RETURNING id',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }
} 
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { newsService, NewsUpdate, ApiError } from '@/services/api';
import NewsForm from '@/components/admin/NewsForm';

export default function EditNewsPage() {
    const params = useParams();
    const [news, setNews] = useState<NewsUpdate | null>(null);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                if (!params?.id) {
                    throw new Error('News ID is required');
                }
                const newsId = Array.isArray(params.id) 
                    ? parseInt(params.id[0]) 
                    : parseInt(params.id);
                
                if (isNaN(newsId)) {
                    throw new Error('Invalid news ID');
                }
                const data = await newsService.getById(newsId);
                setNews(data);
            } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Failed to load news item');
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [params]);

    const handleSubmit = async (data: Parameters<typeof newsService.update>[1]) => {
        if (!params?.id) {
            throw new Error('News ID is required');
        }
        const newsId = Array.isArray(params.id) 
            ? parseInt(params.id[0]) 
            : parseInt(params.id);
        
        if (isNaN(newsId)) {
            throw new Error('Invalid news ID');
        }
        await newsService.update(newsId, data);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
            </div>
        );
    }

    if (!news) {
        return (
            <div className="rounded-md bg-yellow-50 p-4">
                <div className="text-sm text-yellow-700">News item not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="md:flex md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Edit News
                    </h2>
                </div>
            </div>

            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
                <div className="px-4 py-6 sm:p-8">
                    <NewsForm
                        initialData={news}
                        onSubmit={handleSubmit}
                        submitLabel="Update News"
                    />
                </div>
            </div>
        </div>
    );
} 
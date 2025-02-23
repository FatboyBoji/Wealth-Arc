'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { newsService, NewsUpdate, NewsType, ApiError } from '@/services/api';

export default function DashboardPage() {
    const [news, setNews] = useState<NewsUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [selectedType, setSelectedType] = useState<NewsType | ''>('');

    const newsTypes: NewsType[] = ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'];

    const loadNews = async (type?: NewsType) => {
        try {
            setLoading(true);
            const data = await newsService.getAll(type);
            setNews(data);
            setError('');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to load news');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNews(selectedType || undefined);
    }, [selectedType]);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this news item?')) {
            return;
        }

        try {
            await newsService.delete(id);
            setNews(news.filter(item => item.id !== id));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to delete news');
        }
    };

    const formatDate = (date: string | Date) => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Add a function to get type-specific styles
    const getTypeStyles = (type: NewsType) => {
        switch (type) {
            case 'neuigkeiten':
                return 'text-blue-700 font-medium';
            case 'releases':
                return 'text-green-700 font-medium';
            case 'frameworks':
                return 'text-purple-700 font-medium';
            case 'ankündigungen':
                return 'text-orange-700 font-medium';
            default:
                return 'text-gray-700';
        }
    };

    // Add a function to get badge styles for the news items
    const getTypeBadgeStyles = (type: NewsType) => {
        switch (type) {
            case 'neuigkeiten':
                return 'bg-blue-100 text-blue-800';
            case 'releases':
                return 'bg-green-100 text-green-800';
            case 'frameworks':
                return 'bg-purple-100 text-purple-800';
            case 'ankündigungen':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <h1 className="text-2xl font-semibold text-gray-900">News Management</h1>
                <Link
                    href="/admin/news/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent 
                             rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                             hover:bg-blue-700 focus:outline-none focus:ring-2 
                             focus:ring-offset-2 focus:ring-blue-500"
                >
                    Create News
                </Link>
            </div>

            {/* Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor="type-filter" className="text-sm font-medium text-gray-700 min-w-[100px]">
                        Filter by type:
                    </label>
                    <select
                        id="type-filter"
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value as NewsType | '')}
                        className="mt-1 block w-full sm:w-auto pl-3 pr-10 py-2 text-base border-2
                                 border-gray-300 hover:border-blue-600 
                                 focus:outline-none focus:ring-blue-500 focus:border-blue-500 
                                 sm:text-sm rounded-md bg-white shadow-sm font-medium text-gray-900"
                    >
                        <option value="" className="text-gray-900 font-medium py-2">All Types</option>
                        {newsTypes.map(type => (
                            <option key={type} value={type} className={`py-2 ${getTypeStyles(type)}`}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                </div>
            )}

            {/* News List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <ul className="divide-y divide-gray-200">
                    {news.map((item) => (
                        <li key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-medium text-gray-900 truncate">
                                            {item.title}
                                        </h3>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeStyles(item.type)} capitalize`}>
                                                {item.type}
                                            </span>
                                            {item.version && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    v{item.version}
                                                </span>
                                            )}
                                            <span className="text-gray-500">
                                                Published: {formatDate(item.published_at || '')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex space-x-3">
                                        <Link
                                            href={`/admin/news/edit/${item.id}`}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent 
                                                     text-xs font-medium rounded-md text-blue-700 bg-blue-100 
                                                     hover:bg-blue-200 focus:outline-none focus:ring-2 
                                                     focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            onClick={() => item.id && handleDelete(item.id)}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent 
                                                     text-xs font-medium rounded-md text-red-700 bg-red-100 
                                                     hover:bg-red-200 focus:outline-none focus:ring-2 
                                                     focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {news.length === 0 && (
                        <li className="px-4 py-8 text-center text-gray-500">
                            No news items found.
                            {selectedType && (
                                <span className="block mt-1">
                                    Try selecting a different type or create a new news item.
                                </span>
                            )}
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
} 
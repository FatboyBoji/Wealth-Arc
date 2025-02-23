'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NewsUpdate, NewsType, ApiError } from '@/services/api';
import { z } from 'zod';
import RichTextEditor from './RichTextEditor';

// Validation schema
const newsSchema = z.object({
    title: z.string()
        .min(1, 'Title is required')
        .max(255, 'Title must be less than 255 characters'),
    content: z.string()
        .min(1, 'Content is required'),
    type: z.enum(['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'] as const, {
        errorMap: () => ({ message: 'Please select a valid type' })
    }),
    version: z.string().optional(),
    published_at: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

interface NewsFormProps {
    initialData?: NewsUpdate;
    onSubmit: (data: Omit<NewsUpdate, 'id' | 'updated_at'>) => Promise<void>;
    submitLabel: string;
}

interface FormData {
    title: string;
    content: string;
    type: NewsType;
    version: string;
    published_at: string;
}

export default function NewsForm({ initialData, onSubmit, submitLabel }: NewsFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Helper function to format date to YYYY-MM-DD
    const formatDateForInput = (date: string | Date | undefined): string => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString().split('T')[0];
    };

    const [formData, setFormData] = useState<FormData>({
        title: initialData?.title || '',
        content: initialData?.content || '',
        type: initialData?.type || 'neuigkeiten',
        version: initialData?.version || '',
        published_at: formatDateForInput(initialData?.published_at)
    });

    const newsTypes: NewsType[] = ['neuigkeiten', 'releases', 'frameworks', 'ankündigungen'];

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleEditorChange = (content: string) => {
        setFormData(prev => ({ ...prev, content }));
        if (errors.content) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.content;
                return newErrors;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrors({});

        try {
            const validatedData = newsSchema.parse(formData);
            setLoading(true);
            await onSubmit(validatedData);
            router.push('/admin/dashboard');
        } catch (err) {
            if (err instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};
                err.errors.forEach(error => {
                    if (error.path) {
                        newErrors[error.path[0]] = error.message;
                    }
                });
                setErrors(newErrors);
            } else if (err instanceof ApiError) {
                setErrors({ submit: err.message });
            } else {
                setErrors({ submit: 'An unexpected error occurred' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && (
                <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{errors.submit}</div>
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-base font-semibold text-gray-900">
                        Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title || ''}
                        onChange={handleChange}
                        className={`mt-1 block w-full rounded-md shadow-sm text-base bg-white text-gray-900 px-3 py-2
                            ${errors.title
                                ? 'border-2 border-red-500 focus:border-red-500 focus:ring-red-500'
                                : 'border-2 border-gray-900 focus:border-blue-600 focus:ring-blue-600'
                            } placeholder-gray-500`}
                        placeholder="Enter title..."
                    />
                    {errors.title && (
                        <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="type" className="block text-base font-semibold text-gray-900">
                        Type
                    </label>
                    <select
                        id="type"
                        name="type"
                        value={formData.type || 'neuigkeiten'}
                        onChange={handleChange}
                        className={`mt-1 block w-full rounded-md shadow-sm text-base bg-white text-gray-900 px-3 py-2
                            ${errors.type
                                ? 'border-2 border-red-500 focus:border-red-500 focus:ring-red-500'
                                : 'border-2 border-gray-900 focus:border-blue-600 focus:ring-blue-600'
                            }`}
                    >
                        {newsTypes.map(type => (
                            <option key={type} value={type} className="py-2 text-base bg-white text-gray-900 hover:bg-gray-100">
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </option>
                        ))}
                    </select>
                    {errors.type && (
                        <p className="mt-1 text-sm text-red-600">{errors.type}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="version" className="block text-base font-semibold text-gray-900">
                        Version (optional)
                    </label>
                    <input
                        type="text"
                        id="version"
                        name="version"
                        value={formData.version || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md shadow-sm text-base bg-white text-gray-900 px-3 py-2
                                 border-2 border-gray-900 focus:border-blue-600 focus:ring-blue-600 placeholder-gray-500"
                        placeholder="Enter version number..."
                    />
                </div>

                <div>
                    <label htmlFor="published_at" className="block text-base font-semibold text-gray-900">
                        Publication Date (optional)
                    </label>
                    <input
                        type="date"
                        id="published_at"
                        name="published_at"
                        value={formData.published_at || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md shadow-sm text-base bg-white text-gray-900 px-3 py-2
                                 border-2 border-gray-900 focus:border-blue-600 focus:ring-blue-600 placeholder-gray-500"
                    />
                </div>

                <div>
                    <label htmlFor="content" className="block text-base font-semibold text-gray-900">
                        Content
                    </label>
                    <div className="mt-1">
                        <RichTextEditor
                            content={formData.content || ''}
                            onChange={handleEditorChange}
                            error={!!errors.content}
                        />
                    </div>
                    {errors.content && (
                        <p className="mt-1 text-sm text-red-600">{errors.content}</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 border-2 border-gray-900 rounded-md shadow-sm text-base 
                             font-medium text-gray-900 bg-white hover:bg-gray-50 
                             focus:outline-none focus:ring-2 focus:ring-offset-2 
                             focus:ring-blue-500"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center px-4 py-2 border-2 border-transparent 
                             rounded-md shadow-sm text-base font-medium text-white bg-blue-600 
                             hover:bg-blue-700 focus:outline-none focus:ring-2 
                             focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 
                             disabled:cursor-not-allowed"
                >
                    {loading ? 'Saving...' : submitLabel}
                </button>
            </div>
        </form>
    );
} 
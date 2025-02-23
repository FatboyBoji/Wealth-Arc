'use client';

import { newsService } from '@/services/api';
import NewsForm from '@/components/admin/NewsForm';

export default function CreateNewsPage() {
    const handleSubmit = async (data: Parameters<typeof newsService.create>[0]) => {
        await newsService.create(data);
    };

    return (
        <div className="space-y-6">
            <div className="md:flex md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Create News
                    </h2>
                </div>
            </div>

            <div className="bg-white shadow-sm ring-1 ring-red-900/500 sm:rounded-xl md:col-span-2">
                <div className="px-4 py-6 sm:p-8">
                    <NewsForm
                        onSubmit={handleSubmit}
                        submitLabel="Create News"
                    />
                </div>
            </div>
        </div>
    );
} 
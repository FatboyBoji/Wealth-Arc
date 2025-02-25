'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SessionHandler } from '@/components/auth/SessionHandler';
import Link from 'next/link';
import { authService } from '@/services/api';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isAuthenticated && pathname !== '/admin/login') {
            router.push('/admin/login');
        }
        setIsLoading(false);
    }, [isAuthenticated, pathname, router]);

    // Don't show navigation on login page
    if (pathname === '/admin/login') {
        return children;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <SessionHandler />
            {/* Navigation Header */}
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <Link
                                href="/admin/dashboard"
                                className="flex items-center px-4 text-lg font-semibold text-gray-900"
                            >
                                SESA Admin
                            </Link>

                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    href="/admin/dashboard"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                                        ${pathname === '/admin/dashboard'
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/admin/news/create"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                                        ${pathname === '/admin/news/create'
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    Create News
                                </Link>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <button
                                onClick={() => {
                                    authService.logout();
                                    router.push('/admin/login');
                                }}
                                className="ml-4 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
} 
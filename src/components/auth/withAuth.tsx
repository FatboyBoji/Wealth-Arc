'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/api';

export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>
) {
    return function ProtectedRoute(props: P) {
        const router = useRouter();
        const [isAuthenticated, setIsAuthenticated] = useState(false);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            const checkAuth = async () => {
                try {
                    const isValid = await authService.verifyToken();
                    setIsAuthenticated(isValid);
                    if (!isValid) {
                        router.push('/admin/login');
                    }
                } catch (error) {
                    console.error('Authentication check failed:', error);
                    router.push('/admin/login');
                } finally {
                    setIsLoading(false);
                }
            };

            checkAuth();

            // Set up interval to periodically check token validity
            const interval = setInterval(checkAuth, 60000); // Check every minute

            return () => clearInterval(interval);
        }, [router]);

        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            );
        }

        return isAuthenticated ? <WrappedComponent {...props} /> : null;
    };
} 
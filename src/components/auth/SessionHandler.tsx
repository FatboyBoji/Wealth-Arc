'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export function SessionHandler() {
    const { logout, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/admin/login');
            return;
        }

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                try {
                    const response = await fetch('/api/auth/check-session');
                    if (!response.ok) {
                        await logout();
                        router.push('/admin/login');
                    }
                } catch (error) {
                    console.error('Session check failed:', error);
                    await logout();
                    router.push('/admin/login');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [logout, router, isAuthenticated]);

    return null;
} 
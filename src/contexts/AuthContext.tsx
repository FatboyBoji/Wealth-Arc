import { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType } from '@/types/auth';

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentSession, setCurrentSession] = useState<AuthContextType['currentSession']>();

    const login = async (token: string) => {
        // Store token and update session
        localStorage.setItem('token', token);
        // Parse token and set current session
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentSession({
            userId: payload.userId,
            tokenId: payload.tokenId
        });
    };

    return (
        <AuthContext.Provider value={{ login, currentSession }}>
            {children}
        </AuthContext.Provider>
    );
}; 
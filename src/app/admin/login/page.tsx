'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    authService, 
    MaxSessionsError,
    DeviceSession,
    ApiError
} from '@/services/api';
import { DeviceSessionModal } from '@/components/admin/DeviceSessionModal';
import { LoginForm } from '@/components/admin/LoginForm';
import { logToFile } from '@/utils/logger';
import { Box, Container, Paper } from '@mui/material';

export default function LoginPage() {
    const router = useRouter();

    return (
        <Container maxWidth="sm">
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <Paper elevation={3} sx={{ p: 4, width: '100%', borderRadius: 2 }}>
                    <LoginForm 
                        onSuccess={() => router.push('/admin/dashboard')}
                    />
                </Paper>
            </Box>
        </Container>
    );
} 
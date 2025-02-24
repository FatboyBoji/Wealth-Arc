import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();
        const logPath = path.join(process.cwd(), 'session-debug.log');
        
        await fs.appendFile(logPath, message);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to write log:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
} 
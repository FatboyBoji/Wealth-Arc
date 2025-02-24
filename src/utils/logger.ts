export const logToFile = async (message: string, data?: any) => {
    try {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) + '\n' : ''}`;
        
        const response = await fetch('/api/debug-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: logMessage }),
        });

        if (!response.ok) {
            console.error('Failed to write to log file');
        }
    } catch (error) {
        console.error('Logging error:', error);
    }
}; 
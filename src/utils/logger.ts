export const logToFile = async (message: string, data?: any) => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message,
            data,
            source: 'frontend'
        };
        
        console.log(`[Frontend Log] ${message}:`, data); // Add immediate console logging

        const response = await fetch('/api/debug-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logEntry),
        });

        if (!response.ok) {
            console.error('[Logger] Failed to write to log file:', await response.text());
        }
    } catch (error) {
        console.error('[Logger] Error:', error);
        // Fallback to console
        console.log(`[${new Date().toISOString()}] ${message}`, data);
    }
}; 
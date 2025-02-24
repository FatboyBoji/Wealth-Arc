export interface DeviceInfo {
    type: string;
    browser: string;
    os: string;
    timestamp?: string;
    screenSize?: {
        width: number;
        height: number;
    };
}

export function getDeviceInfo(): DeviceInfo {
    console.log('Getting device info...');

    if (typeof window === 'undefined') {
        console.log('Window is undefined (server-side)');
        return {
            type: 'unknown',
            browser: 'unknown',
            os: 'unknown',
            timestamp: new Date().toISOString()
        };
    }

    const ua = window.navigator.userAgent.toLowerCase();
    console.log('User Agent:', ua);
    
    // Device type detection
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
    const isTablet = /tablet|ipad/i.test(ua);
    const type = isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop');
    
    // Browser detection
    let browser = 'unknown';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';
    
    // OS detection
    let os = 'unknown';
    if (ua.includes('win')) os = 'Windows';
    else if (ua.includes('mac')) os = 'MacOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    const deviceInfo = {
        type,
        browser,
        os,
        timestamp: new Date().toISOString(),
        screenSize: typeof window !== 'undefined' ? {
            width: window.screen.width,
            height: window.screen.height
        } : undefined
    };

    console.log('Detected device info:', deviceInfo);
    return deviceInfo;
}

// Optional: Add a function to get a friendly device name
export function getDeviceFriendlyName(info: DeviceInfo): string {
    return `${info.os} ${info.browser} on ${info.type}`;
} 
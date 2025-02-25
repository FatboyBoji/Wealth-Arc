export interface DeviceInfo {
    type: string;
    browser: string;
    os: string;
    timestamp: string;
    screenSize: {
        width: number;
        height: number;
    };
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
    return {
        type: 'desktop', // You can make this more sophisticated
        browser: getBrowserInfo(),
        os: getOSInfo(),
        timestamp: new Date().toISOString(),
        screenSize: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };
}

function getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
}

function getOSInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'MacOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
}

// Optional: Add a function to get a friendly device name
export function getDeviceFriendlyName(info: DeviceInfo): string {
    return `${info.os} ${info.browser} on ${info.type}`;
} 
export interface DeviceInfo {
    type: string;
    os: string;
    browser: string;
    name: string;
}

export interface AuthContextType {
    login: (token: string) => Promise<void>;
    currentSession?: {
        userId: number;
        tokenId: string;
    };
} 
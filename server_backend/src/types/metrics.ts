export interface Metrics {
    timestamp?: Date;
    duration?: number;
    success?: boolean;
    errorCount?: number;
}

export interface JobMetrics extends Metrics {
    jobName: string;
    lastRun: Date;
    nextRun?: Date;
    attempts: number;
}

export interface PerformanceMetrics extends Metrics {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
} 
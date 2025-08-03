/**
 * Addon Service
 * Handles business logic for serving addon code
 */
export interface AddonMetadata {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: string[];
    endpoint: string;
}
export interface AddonHealth {
    status: 'healthy' | 'unhealthy';
    service: string;
    timestamp: string;
    addons: {
        id: string;
        available: boolean;
        lastAccessed?: string;
    }[];
}
export declare class AddonService {
    private readonly addonsPath;
    private lastAccessTime;
    constructor();
    /**
     * Retrieves the ChatGPT addon code from file
     */
    getChatGPTAddonCode(): Promise<string>;
    /**
     * Returns health status of addon service
     */
    getHealth(): Promise<AddonHealth>;
    /**
     * Returns metadata about available addons
     */
    getAddonMetadata(): Promise<AddonMetadata[]>;
    /**
     * Helper method to check if a file exists
     */
    private fileExists;
}
//# sourceMappingURL=addon.service.d.ts.map
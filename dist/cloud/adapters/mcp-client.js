"use strict";
/*
 * Copyright (C) 2024-present Semantest, rydnr
 *
 * This file is part of @semantest/nodejs.server.
 *
 * @semantest/nodejs.server is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * @semantest/nodejs.server is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @semantest/nodejs.server. If not, see <https://www.gnu.org/licenses/>.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = exports.MCPContextHelper = void 0;
const axios_1 = __importDefault(require("axios"));
class MCPContextHelper {
    static fromJSON(data) {
        return {
            id: data.id,
            modelId: data.modelId,
            createdAt: new Date(data.createdAt),
            expiresAt: new Date(data.expiresAt),
            confidence: data.confidence || 0.8,
            capabilities: data.capabilities || []
        };
    }
}
exports.MCPContextHelper = MCPContextHelper;
/**
 * MCP Client for AI Integration
 *
 * Provides communication with Model Context Protocol (MCP) services
 * for AI-powered workflow generation, optimization, and learning.
 */
class MCPClient {
    constructor(config) {
        this.config = config;
        this.rateLimiter = new Map();
        this.httpClient = axios_1.default.create({
            baseURL: config.endpoint,
            timeout: config.timeout,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Semantest-MCP-Client/1.0.0'
            }
        });
        this.setupInterceptors();
    }
    /**
     * Creates a new MCP context for AI operations
     */
    async createContext(request) {
        await this.checkRateLimit('createContext');
        try {
            const response = await this.httpClient.post('/contexts', {
                modelId: request.modelId,
                workflow: request.workflow ? this.serializeWorkflow(request.workflow) : null,
                capabilities: request.capabilities || [],
                constraints: request.constraints || {},
                examples: request.examples || [],
                preferences: request.preferences || {},
                executionHistory: request.executionHistory || [],
                optimizationGoals: request.optimizationGoals || []
            });
            return MCPContextHelper.fromJSON(response.data);
        }
        catch (error) {
            this.handleError('createContext', error);
            throw error;
        }
    }
    /**
     * Generates a new workflow using AI
     */
    async generateWorkflow(request) {
        await this.checkRateLimit('generateWorkflow');
        try {
            const response = await this.httpClient.post('/workflows/generate', {
                contextId: request.contextId,
                objective: request.objective,
                domain: request.domain,
                examples: request.examples || [],
                preferences: request.preferences || {},
                optimizationGoals: request.optimizationGoals || ['reliability', 'performance']
            });
            return this.deserializeWorkflow(response.data);
        }
        catch (error) {
            this.handleError('generateWorkflow', error);
            throw error;
        }
    }
    /**
     * Optimizes an existing workflow using AI
     */
    async optimizeWorkflow(request) {
        await this.checkRateLimit('optimizeWorkflow');
        try {
            const response = await this.httpClient.post('/workflows/optimize', {
                contextId: request.contextId,
                currentWorkflow: this.serializeWorkflow(request.currentWorkflow),
                executionHistory: request.executionHistory,
                optimizationGoals: request.optimizationGoals,
                constraints: request.constraints || {}
            });
            return this.deserializeWorkflow(response.data);
        }
        catch (error) {
            this.handleError('optimizeWorkflow', error);
            throw error;
        }
    }
    /**
     * Repairs a workflow with validation errors using AI
     */
    async repairWorkflow(request) {
        await this.checkRateLimit('repairWorkflow');
        try {
            const response = await this.httpClient.post('/workflows/repair', {
                contextId: request.contextId,
                workflow: this.serializeWorkflow(request.workflow),
                errors: request.errors,
                repairStrategy: request.repairStrategy
            });
            return this.deserializeWorkflow(response.data);
        }
        catch (error) {
            this.handleError('repairWorkflow', error);
            throw error;
        }
    }
    /**
     * Generates documentation for a workflow using AI
     */
    async generateDocumentation(request) {
        await this.checkRateLimit('generateDocumentation');
        try {
            const response = await this.httpClient.post('/documentation/generate', {
                contextId: request.contextId,
                workflow: this.serializeWorkflow(request.workflow),
                format: request.format,
                includeExamples: request.includeExamples,
                includePerformanceNotes: request.includePerformanceNotes
            });
            return response.data.documentation;
        }
        catch (error) {
            this.handleError('generateDocumentation', error);
            throw error;
        }
    }
    /**
     * Provides feedback to AI model for learning
     */
    async provideFeedback(feedback) {
        await this.checkRateLimit('provideFeedback');
        try {
            await this.httpClient.post('/feedback', {
                workflowId: feedback.workflowId,
                modelId: feedback.modelId,
                contextId: feedback.contextId,
                success: feedback.success,
                performance: feedback.performance,
                issues: feedback.issues,
                improvements: feedback.improvements,
                qualityScore: feedback.qualityScore,
                userSatisfaction: feedback.userSatisfaction,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.handleError('provideFeedback', error);
            throw error;
        }
    }
    /**
     * Deletes an MCP context
     */
    async deleteContext(contextId) {
        await this.checkRateLimit('deleteContext');
        try {
            await this.httpClient.delete(`/contexts/${contextId}`);
        }
        catch (error) {
            this.handleError('deleteContext', error);
            throw error;
        }
    }
    /**
     * Gets health status of MCP service
     */
    async getHealthStatus() {
        try {
            const response = await this.httpClient.get('/health');
            return {
                status: 'healthy',
                details: response.data
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error.message,
                    endpoint: this.config.endpoint
                }
            };
        }
    }
    /**
     * Gets MCP service metrics
     */
    async getMetrics() {
        try {
            const response = await this.httpClient.get('/metrics');
            return {
                ...response.data,
                clientMetrics: {
                    rateLimitUsage: this.getRateLimitUsage(),
                    totalRequests: this.getTotalRequests(),
                    lastRequestTime: this.getLastRequestTime()
                }
            };
        }
        catch (error) {
            return {
                error: error.message,
                clientMetrics: {
                    rateLimitUsage: this.getRateLimitUsage(),
                    totalRequests: this.getTotalRequests(),
                    lastRequestTime: this.getLastRequestTime()
                }
            };
        }
    }
    /**
     * Sets up HTTP interceptors for logging and error handling
     */
    setupInterceptors() {
        // Request interceptor
        this.httpClient.interceptors.request.use((config) => {
            console.log(`MCP Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            console.error('MCP Request Error:', error);
            return Promise.reject(error);
        });
        // Response interceptor
        this.httpClient.interceptors.response.use((response) => {
            console.log(`MCP Response: ${response.status} ${response.config.url}`);
            return response;
        }, (error) => {
            console.error('MCP Response Error:', error.response?.status, error.response?.data);
            return Promise.reject(error);
        });
    }
    /**
     * Checks rate limit for operation
     */
    async checkRateLimit(operation) {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        if (!this.rateLimiter.has(operation)) {
            this.rateLimiter.set(operation, []);
        }
        const requests = this.rateLimiter.get(operation);
        // Remove old requests outside window
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);
        this.rateLimiter.set(operation, recentRequests);
        if (recentRequests.length >= this.config.rateLimitPerMinute) {
            const waitTime = recentRequests[0] + 60000 - now;
            throw new Error(`Rate limit exceeded for ${operation}. Wait ${waitTime}ms`);
        }
        // Add current request
        recentRequests.push(now);
    }
    /**
     * Serializes workflow for API transmission
     */
    serializeWorkflow(workflow) {
        return {
            id: workflow.id,
            name: workflow.name,
            domain: workflow.domain,
            objective: workflow.objective,
            steps: workflow.steps,
            requiredCapabilities: workflow.requiredCapabilities,
            constraints: workflow.constraints,
            metadata: workflow.metadata,
            estimatedDuration: workflow.estimatedDuration
        };
    }
    /**
     * Deserializes workflow from API response
     */
    deserializeWorkflow(data) {
        return {
            id: data.id || `workflow-${Date.now()}`,
            name: data.name || 'AI Generated Workflow',
            domain: data.domain,
            objective: data.objective,
            steps: data.steps || [],
            requiredCapabilities: data.requiredCapabilities || [],
            constraints: data.constraints || {},
            metadata: data.metadata || {},
            estimatedDuration: data.estimatedDuration || 0,
            correlationId: data.correlationId
        };
    }
    /**
     * Handles and logs errors
     */
    handleError(operation, error) {
        console.error(`MCP ${operation} failed:`, {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            config: {
                url: error.config?.url,
                method: error.config?.method
            }
        });
    }
    /**
     * Gets current rate limit usage
     */
    getRateLimitUsage() {
        const usage = {};
        const now = Date.now();
        const windowStart = now - 60000;
        for (const [operation, requests] of this.rateLimiter) {
            const recentRequests = requests.filter(timestamp => timestamp > windowStart);
            usage[operation] = recentRequests.length;
        }
        return usage;
    }
    /**
     * Gets total request count
     */
    getTotalRequests() {
        let total = 0;
        for (const requests of this.rateLimiter.values()) {
            total += requests.length;
        }
        return total;
    }
    /**
     * Gets last request timestamp
     */
    getLastRequestTime() {
        let lastTime = 0;
        for (const requests of this.rateLimiter.values()) {
            if (requests.length > 0) {
                lastTime = Math.max(lastTime, Math.max(...requests));
            }
        }
        return lastTime > 0 ? new Date(lastTime) : null;
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=mcp-client.js.map
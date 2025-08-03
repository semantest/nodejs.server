/**
 * @fileoverview Example Express integration with authentication system
 * @description Shows how to integrate the authentication system with Express
 * @author Semantest Team
 */
import express from 'express';
import { AuthModule } from '../auth-module';
/**
 * Example Express application with authentication
 */
declare class ExampleApp {
    private readonly app;
    private readonly authModule;
    constructor();
    /**
     * Setup basic Express middleware
     */
    private setupMiddleware;
    /**
     * Setup application routes
     */
    private setupRoutes;
    /**
     * Setup protected routes (require authentication)
     */
    private setupProtectedRoutes;
    /**
     * Setup admin routes (require admin role)
     */
    private setupAdminRoutes;
    /**
     * Setup API key routes (require API key authentication)
     */
    private setupApiKeyRoutes;
    /**
     * Setup mixed authentication routes (optional authentication)
     */
    private setupMixedAuthRoutes;
    /**
     * Start the Express server
     */
    start(port?: number): void;
    /**
     * Shutdown the server gracefully
     */
    shutdown(): Promise<void>;
}
/**
 * Example usage with environment variables
 */
declare function createExampleApp(): ExampleApp;
/**
 * Example middleware for permission-based access
 */
declare function createPermissionExample(authModule: AuthModule): express.Router;
export { ExampleApp, createExampleApp, createPermissionExample };
//# sourceMappingURL=express-integration.d.ts.map
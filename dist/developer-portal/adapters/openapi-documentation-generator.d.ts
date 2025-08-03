/**
 * @fileoverview OpenAPI documentation generator
 * @description Generates OpenAPI specifications and other documentation formats
 * @author Web-Buddy Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { ApiDocumentation } from '../domain/developer-portal-entities';
/**
 * OpenAPI documentation generator for API documentation
 */
export declare class OpenApiDocumentationGenerator extends Adapter {
    private readonly apiVersion;
    private readonly baseUrl;
    private readonly title;
    private readonly description;
    constructor();
    /**
     * Generate OpenAPI specification
     */
    generateOpenApiSpec(endpoints: string[], options?: any): Promise<ApiDocumentation>;
    /**
     * Generate Postman collection
     */
    generatePostmanCollection(endpoints: string[], options?: any): Promise<ApiDocumentation>;
    /**
     * Generate Insomnia collection
     */
    generateInsomniaCollection(endpoints: string[], options?: any): Promise<ApiDocumentation>;
    /**
     * Generate cURL examples
     */
    generateCurlExamples(endpoints: string[], options?: any): Promise<ApiDocumentation>;
    /**
     * Generate OpenAPI paths
     */
    private generatePaths;
    /**
     * Generate OpenAPI schemas
     */
    private generateSchemas;
    /**
     * Generate security schemes
     */
    private generateSecuritySchemes;
    /**
     * Generate Postman authentication
     */
    private generatePostmanAuth;
    /**
     * Generate Postman variables
     */
    private generatePostmanVariables;
    /**
     * Generate cURL commands for endpoint
     */
    private generateCurlCommands;
    /**
     * Helper methods
     */
    private getEndpointDefinitions;
    private generateDocumentationId;
    private getAuthenticationMethods;
    private generateApiExamples;
    private formatResponses;
    private extractSchemaReferences;
    private generateCommonResponses;
    private generateCommonParameters;
    private generateExamples;
    private generateSecurityRequirements;
    private generateTags;
    private generatePostmanItems;
    private generateInsomniaResources;
}
//# sourceMappingURL=openapi-documentation-generator.d.ts.map
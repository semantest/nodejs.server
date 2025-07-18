/**
 * @fileoverview OpenAPI documentation generator
 * @description Generates OpenAPI specifications and other documentation formats
 * @author Web-Buddy Team
 */

import { Adapter } from '../../stubs/typescript-eda-stubs';
import { ApiDocumentation, ApiEndpoint, ApiExample } from '../domain/developer-portal-entities';

/**
 * OpenAPI documentation generator for API documentation
 */
export class OpenApiDocumentationGenerator extends Adapter {
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly title: string;
  private readonly description: string;

  constructor() {
    super();
    this.apiVersion = process.env.API_VERSION || '1.0.0';
    this.baseUrl = process.env.API_BASE_URL || 'https://api.web-buddy.com';
    this.title = process.env.API_TITLE || 'Web-Buddy API';
    this.description = process.env.API_DESCRIPTION || 'RESTful API for Web-Buddy automation platform';
  }

  /**
   * Generate OpenAPI specification
   */
  public async generateOpenApiSpec(endpoints: string[], options?: any): Promise<ApiDocumentation> {
    const apiEndpoints = await this.getEndpointDefinitions(endpoints);
    
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: this.title,
        description: this.description,
        version: this.apiVersion,
        contact: {
          name: 'Web-Buddy Support',
          url: 'https://web-buddy.com/support',
          email: 'support@web-buddy.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: this.baseUrl,
          description: 'Production server'
        },
        {
          url: this.baseUrl.replace('api.', 'api-staging.'),
          description: 'Staging server'
        }
      ],
      paths: this.generatePaths(apiEndpoints),
      components: {
        schemas: this.generateSchemas(apiEndpoints),
        securitySchemes: this.generateSecuritySchemes(),
        responses: this.generateCommonResponses(),
        parameters: this.generateCommonParameters(),
        examples: this.generateExamples(apiEndpoints)
      },
      security: this.generateSecurityRequirements(),
      tags: this.generateTags(apiEndpoints)
    };

    return {
      id: this.generateDocumentationId(),
      title: this.title,
      description: this.description,
      version: this.apiVersion,
      format: 'openapi',
      content: openApiSpec,
      endpoints: apiEndpoints,
      authentication: this.getAuthenticationMethods(),
      examples: this.generateApiExamples(apiEndpoints),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate Postman collection
   */
  public async generatePostmanCollection(endpoints: string[], options?: any): Promise<ApiDocumentation> {
    const apiEndpoints = await this.getEndpointDefinitions(endpoints);
    
    const postmanCollection = {
      info: {
        name: this.title,
        description: this.description,
        version: this.apiVersion,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: this.generatePostmanAuth(),
      variable: this.generatePostmanVariables(),
      item: this.generatePostmanItems(apiEndpoints)
    };

    return {
      id: this.generateDocumentationId(),
      title: `${this.title} - Postman Collection`,
      description: this.description,
      version: this.apiVersion,
      format: 'postman',
      content: postmanCollection,
      endpoints: apiEndpoints,
      authentication: this.getAuthenticationMethods(),
      examples: this.generateApiExamples(apiEndpoints),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate Insomnia collection
   */
  public async generateInsomniaCollection(endpoints: string[], options?: any): Promise<ApiDocumentation> {
    const apiEndpoints = await this.getEndpointDefinitions(endpoints);
    
    const insomniaCollection = {
      _type: 'export',
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: 'web-buddy-api',
      resources: this.generateInsomniaResources(apiEndpoints)
    };

    return {
      id: this.generateDocumentationId(),
      title: `${this.title} - Insomnia Collection`,
      description: this.description,
      version: this.apiVersion,
      format: 'insomnia',
      content: insomniaCollection,
      endpoints: apiEndpoints,
      authentication: this.getAuthenticationMethods(),
      examples: this.generateApiExamples(apiEndpoints),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate cURL examples
   */
  public async generateCurlExamples(endpoints: string[], options?: any): Promise<ApiDocumentation> {
    const apiEndpoints = await this.getEndpointDefinitions(endpoints);
    
    const curlExamples = apiEndpoints.map(endpoint => ({
      endpoint: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      examples: this.generateCurlCommands(endpoint)
    }));

    return {
      id: this.generateDocumentationId(),
      title: `${this.title} - cURL Examples`,
      description: this.description,
      version: this.apiVersion,
      format: 'curl',
      content: curlExamples,
      endpoints: apiEndpoints,
      authentication: this.getAuthenticationMethods(),
      examples: this.generateApiExamples(apiEndpoints),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate OpenAPI paths
   */
  private generatePaths(endpoints: ApiEndpoint[]): any {
    const paths: any = {};
    
    for (const endpoint of endpoints) {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }
      
      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.summary,
        description: endpoint.description,
        operationId: endpoint.operationId,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: this.formatResponses(endpoint.responses),
        security: endpoint.security,
        deprecated: endpoint.deprecated
      };
    }
    
    return paths;
  }

  /**
   * Generate OpenAPI schemas
   */
  private generateSchemas(endpoints: ApiEndpoint[]): any {
    const schemas: any = {};
    
    // Common schemas
    schemas.Error = {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string' },
        details: { type: 'object' }
      }
    };
    
    schemas.Success = {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' }
      }
    };
    
    // Extract schemas from endpoints
    for (const endpoint of endpoints) {
      if (endpoint.requestBody?.content) {
        for (const mediaType of Object.values(endpoint.requestBody.content)) {
          if (mediaType.schema) {
            this.extractSchemaReferences(mediaType.schema, schemas);
          }
        }
      }
      
      for (const response of endpoint.responses) {
        if (response.content) {
          for (const mediaType of Object.values(response.content)) {
            if (mediaType.schema) {
              this.extractSchemaReferences(mediaType.schema, schemas);
            }
          }
        }
      }
    }
    
    return schemas;
  }

  /**
   * Generate security schemes
   */
  private generateSecuritySchemes(): any {
    return {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      OAuth2: {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: `${this.baseUrl}/oauth/authorize`,
            tokenUrl: `${this.baseUrl}/oauth/token`,
            scopes: {
              read: 'Read access',
              write: 'Write access',
              admin: 'Admin access'
            }
          }
        }
      }
    };
  }

  /**
   * Generate Postman authentication
   */
  private generatePostmanAuth(): any {
    return {
      type: 'apikey',
      apikey: [
        {
          key: 'key',
          value: 'X-API-Key',
          type: 'string'
        },
        {
          key: 'value',
          value: '{{api_key}}',
          type: 'string'
        }
      ]
    };
  }

  /**
   * Generate Postman variables
   */
  private generatePostmanVariables(): any[] {
    return [
      {
        key: 'base_url',
        value: this.baseUrl,
        type: 'string'
      },
      {
        key: 'api_key',
        value: 'your-api-key-here',
        type: 'string'
      }
    ];
  }

  /**
   * Generate cURL commands for endpoint
   */
  private generateCurlCommands(endpoint: ApiEndpoint): string[] {
    const commands: string[] = [];
    
    // Basic command
    let cmd = `curl -X ${endpoint.method} "${this.baseUrl}${endpoint.path}"`;
    
    // Add headers
    cmd += ' -H "Content-Type: application/json"';
    cmd += ' -H "X-API-Key: YOUR_API_KEY"';
    
    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.requestBody) {
      cmd += ' -d \'{"example": "data"}\'';
    }
    
    commands.push(cmd);
    
    return commands;
  }

  /**
   * Helper methods
   */
  private async getEndpointDefinitions(endpoints: string[]): Promise<ApiEndpoint[]> {
    // Mock implementation - in production, this would fetch from API registry
    return endpoints.map(path => ({
      id: `endpoint_${path.replace(/\//g, '_')}`,
      path,
      method: 'GET',
      summary: `${path} endpoint`,
      description: `Description for ${path}`,
      operationId: `get${path.replace(/\//g, '')}`,
      tags: [path.split('/')[2] || 'default'],
      parameters: [],
      responses: [
        {
          statusCode: 200,
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      ],
      security: [{ ApiKeyAuth: [] }],
      deprecated: false,
      rateLimit: {
        tier: 'free',
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10,
        concurrentRequests: 5
      },
      examples: []
    }));
  }

  private generateDocumentationId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAuthenticationMethods(): any[] {
    return [
      {
        type: 'apiKey',
        name: 'API Key',
        description: 'API key authentication',
        in: 'header'
      },
      {
        type: 'bearer',
        name: 'JWT Token',
        description: 'JWT token authentication',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    ];
  }

  private generateApiExamples(endpoints: ApiEndpoint[]): ApiExample[] {
    return endpoints.map(endpoint => ({
      id: `example_${endpoint.id}`,
      name: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.description,
      method: endpoint.method,
      url: `${this.baseUrl}${endpoint.path}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'YOUR_API_KEY'
      },
      body: endpoint.method !== 'GET' ? '{"example": "data"}' : undefined,
      response: {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{"success": true, "data": {}}'
      },
      language: 'json',
      category: endpoint.tags[0] || 'default'
    }));
  }

  private formatResponses(responses: any[]): any {
    const formatted: any = {};
    
    for (const response of responses) {
      formatted[response.statusCode.toString()] = {
        description: response.description,
        headers: response.headers,
        content: response.content
      };
    }
    
    return formatted;
  }

  private extractSchemaReferences(schema: any, schemas: any): void {
    // Mock implementation - in production, this would extract schema references
  }

  private generateCommonResponses(): any {
    return {
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    };
  }

  private generateCommonParameters(): any {
    return {
      limitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items to return',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10
        }
      },
      offsetParam: {
        name: 'offset',
        in: 'query',
        description: 'Number of items to skip',
        schema: {
          type: 'integer',
          minimum: 0,
          default: 0
        }
      }
    };
  }

  private generateExamples(endpoints: ApiEndpoint[]): any {
    const examples: any = {};
    
    for (const endpoint of endpoints) {
      examples[`${endpoint.operationId}Example`] = {
        summary: `Example for ${endpoint.summary}`,
        value: {
          example: 'data'
        }
      };
    }
    
    return examples;
  }

  private generateSecurityRequirements(): any[] {
    return [
      { ApiKeyAuth: [] },
      { BearerAuth: [] }
    ];
  }

  private generateTags(endpoints: ApiEndpoint[]): any[] {
    const tags = new Set<string>();
    
    for (const endpoint of endpoints) {
      endpoint.tags.forEach(tag => tags.add(tag));
    }
    
    return Array.from(tags).map(tag => ({
      name: tag,
      description: `${tag} related endpoints`
    }));
  }

  private generatePostmanItems(endpoints: ApiEndpoint[]): any[] {
    return endpoints.map(endpoint => ({
      name: `${endpoint.method} ${endpoint.path}`,
      request: {
        method: endpoint.method,
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        url: {
          raw: `{{base_url}}${endpoint.path}`,
          host: ['{{base_url}}'],
          path: endpoint.path.split('/').filter(Boolean)
        },
        body: endpoint.method !== 'GET' ? {
          mode: 'raw',
          raw: JSON.stringify({ example: 'data' }, null, 2)
        } : undefined
      },
      response: []
    }));
  }

  private generateInsomniaResources(endpoints: ApiEndpoint[]): any[] {
    const resources: any[] = [];
    
    // Add workspace
    resources.push({
      _id: 'wrk_1',
      _type: 'workspace',
      name: this.title,
      description: this.description
    });
    
    // Add environment
    resources.push({
      _id: 'env_1',
      _type: 'environment',
      name: 'Base Environment',
      data: {
        base_url: this.baseUrl,
        api_key: 'your-api-key-here'
      },
      parentId: 'wrk_1'
    });
    
    // Add requests
    endpoints.forEach((endpoint, index) => {
      resources.push({
        _id: `req_${index + 1}`,
        _type: 'request',
        name: `${endpoint.method} ${endpoint.path}`,
        method: endpoint.method,
        url: `{{ base_url }}${endpoint.path}`,
        headers: [
          {
            name: 'Content-Type',
            value: 'application/json'
          }
        ],
        body: endpoint.method !== 'GET' ? {
          mimeType: 'application/json',
          text: JSON.stringify({ example: 'data' }, null, 2)
        } : undefined,
        parentId: 'wrk_1'
      });
    });
    
    return resources;
  }
}
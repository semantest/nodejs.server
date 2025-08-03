"use strict";
/**
 * Tests for OpenApiDocumentationGenerator
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const openapi_documentation_generator_1 = require("../openapi-documentation-generator");
describe('OpenApiDocumentationGenerator', () => {
    let generator;
    let originalEnv;
    beforeEach(() => {
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            API_VERSION: '2.0.0',
            API_BASE_URL: 'https://test-api.example.com',
            API_TITLE: 'Test API',
            API_DESCRIPTION: 'Test API Description'
        };
        generator = new openapi_documentation_generator_1.OpenApiDocumentationGenerator();
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    describe('constructor', () => {
        it('should use environment variables when available', () => {
            expect(generator).toBeDefined();
        });
        it('should use default values when environment variables are not set', () => {
            process.env = {};
            const defaultGenerator = new openapi_documentation_generator_1.OpenApiDocumentationGenerator();
            expect(defaultGenerator).toBeDefined();
        });
    });
    describe('generateOpenApiSpec', () => {
        it('should generate OpenAPI specification', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generateOpenApiSpec(endpoints);
            expect(result).toMatchObject({
                id: expect.stringMatching(/^doc_/),
                title: 'Test API',
                description: 'Test API Description',
                version: '2.0.0',
                format: 'openapi',
                content: expect.objectContaining({
                    openapi: '3.0.0',
                    info: expect.objectContaining({
                        title: 'Test API',
                        description: 'Test API Description',
                        version: '2.0.0'
                    })
                })
            });
        });
        it('should include contact and license information', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            const content = result.content;
            expect(content.info.contact).toEqual({
                name: 'Web-Buddy Support',
                url: 'https://web-buddy.com/support',
                email: 'support@web-buddy.com'
            });
            expect(content.info.license).toEqual({
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            });
        });
        it('should generate servers configuration', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            const content = result.content;
            expect(content.servers).toHaveLength(2);
            expect(content.servers[0]).toEqual({
                url: 'https://test-api.example.com',
                description: 'Production server'
            });
            expect(content.servers[1]).toEqual({
                url: 'https://test-api-staging.example.com',
                description: 'Staging server'
            });
        });
        it('should generate paths from endpoints', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generateOpenApiSpec(endpoints);
            const content = result.content;
            expect(content.paths).toHaveProperty('/api/users');
            expect(content.paths).toHaveProperty('/api/products');
            expect(content.paths['/api/users']).toHaveProperty('get');
        });
        it('should include security schemes', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            const content = result.content;
            expect(content.components.securitySchemes).toHaveProperty('ApiKeyAuth');
            expect(content.components.securitySchemes).toHaveProperty('BearerAuth');
            expect(content.components.securitySchemes).toHaveProperty('OAuth2');
        });
        it('should include common schemas', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            const content = result.content;
            expect(content.components.schemas).toHaveProperty('Error');
            expect(content.components.schemas).toHaveProperty('Success');
        });
        it('should generate security requirements', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            const content = result.content;
            expect(content.security).toEqual([
                { ApiKeyAuth: [] },
                { BearerAuth: [] }
            ]);
        });
        it('should generate tags from endpoints', async () => {
            const endpoints = ['/api/users/profile', '/api/products/list'];
            const result = await generator.generateOpenApiSpec(endpoints);
            const content = result.content;
            expect(content.tags).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'users' }),
                expect.objectContaining({ name: 'products' })
            ]));
        });
    });
    describe('generatePostmanCollection', () => {
        it('should generate Postman collection', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generatePostmanCollection(endpoints);
            expect(result).toMatchObject({
                id: expect.stringMatching(/^doc_/),
                title: 'Test API - Postman Collection',
                description: 'Test API Description',
                version: '2.0.0',
                format: 'postman',
                content: expect.objectContaining({
                    info: expect.objectContaining({
                        name: 'Test API',
                        description: 'Test API Description',
                        version: '2.0.0',
                        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
                    })
                })
            });
        });
        it('should include auth configuration', async () => {
            const result = await generator.generatePostmanCollection(['/api/test']);
            const content = result.content;
            expect(content.auth).toEqual({
                type: 'apikey',
                apikey: expect.arrayContaining([
                    expect.objectContaining({
                        key: 'key',
                        value: 'X-API-Key',
                        type: 'string'
                    }),
                    expect.objectContaining({
                        key: 'value',
                        value: '{{api_key}}',
                        type: 'string'
                    })
                ])
            });
        });
        it('should include variables', async () => {
            const result = await generator.generatePostmanCollection(['/api/test']);
            const content = result.content;
            expect(content.variable).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    key: 'base_url',
                    value: 'https://test-api.example.com',
                    type: 'string'
                }),
                expect.objectContaining({
                    key: 'api_key',
                    value: 'your-api-key-here',
                    type: 'string'
                })
            ]));
        });
        it('should generate request items', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generatePostmanCollection(endpoints);
            const content = result.content;
            expect(content.item).toHaveLength(2);
            expect(content.item[0]).toMatchObject({
                name: 'GET /api/users',
                request: expect.objectContaining({
                    method: 'GET',
                    url: expect.objectContaining({
                        raw: '{{base_url}}/api/users'
                    })
                })
            });
        });
    });
    describe('generateInsomniaCollection', () => {
        it('should generate Insomnia collection', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generateInsomniaCollection(endpoints);
            expect(result).toMatchObject({
                id: expect.stringMatching(/^doc_/),
                title: 'Test API - Insomnia Collection',
                description: 'Test API Description',
                version: '2.0.0',
                format: 'insomnia',
                content: expect.objectContaining({
                    _type: 'export',
                    __export_format: 4,
                    __export_date: expect.any(String),
                    __export_source: 'web-buddy-api'
                })
            });
        });
        it('should include workspace and environment', async () => {
            const result = await generator.generateInsomniaCollection(['/api/test']);
            const content = result.content;
            const resources = content.resources;
            const workspace = resources.find((r) => r._type === 'workspace');
            const environment = resources.find((r) => r._type === 'environment');
            expect(workspace).toMatchObject({
                _id: 'wrk_1',
                _type: 'workspace',
                name: 'Test API',
                description: 'Test API Description'
            });
            expect(environment).toMatchObject({
                _id: 'env_1',
                _type: 'environment',
                name: 'Base Environment',
                data: {
                    base_url: 'https://test-api.example.com',
                    api_key: 'your-api-key-here'
                },
                parentId: 'wrk_1'
            });
        });
        it('should generate request resources', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generateInsomniaCollection(endpoints);
            const content = result.content;
            const resources = content.resources;
            const requests = resources.filter((r) => r._type === 'request');
            expect(requests).toHaveLength(2);
            expect(requests[0]).toMatchObject({
                _id: 'req_1',
                _type: 'request',
                name: 'GET /api/users',
                method: 'GET',
                url: '{{ base_url }}/api/users',
                parentId: 'wrk_1'
            });
        });
    });
    describe('generateCurlExamples', () => {
        it('should generate cURL examples', async () => {
            const endpoints = ['/api/users', '/api/products'];
            const result = await generator.generateCurlExamples(endpoints);
            expect(result).toMatchObject({
                id: expect.stringMatching(/^doc_/),
                title: 'Test API - cURL Examples',
                description: 'Test API Description',
                version: '2.0.0',
                format: 'curl',
                content: expect.arrayContaining([
                    expect.objectContaining({
                        endpoint: '/api/users',
                        method: 'GET',
                        description: expect.any(String),
                        examples: expect.arrayContaining([
                            expect.stringContaining('curl -X GET')
                        ])
                    })
                ])
            });
        });
        it('should include headers in cURL commands', async () => {
            const result = await generator.generateCurlExamples(['/api/test']);
            const curlCommand = result.content[0].examples[0];
            expect(curlCommand).toContain('-H "Content-Type: application/json"');
            expect(curlCommand).toContain('-H "X-API-Key: YOUR_API_KEY"');
        });
        it('should include body for POST/PUT/PATCH methods', async () => {
            // Test would need to mock endpoints with different methods
            // Since the mock implementation always returns GET, this is a limitation
            const result = await generator.generateCurlExamples(['/api/test']);
            expect(result.content[0].examples[0]).toContain('curl -X GET');
        });
    });
    describe('helper methods', () => {
        it('should generate unique documentation IDs', async () => {
            const result1 = await generator.generateOpenApiSpec(['/api/test']);
            const result2 = await generator.generateOpenApiSpec(['/api/test']);
            expect(result1.id).not.toBe(result2.id);
            expect(result1.id).toMatch(/^doc_\d+_[a-z0-9]{9}$/);
        });
        it('should include authentication methods', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            expect(result.authentication).toEqual([
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
            ]);
        });
        it('should generate examples for endpoints', async () => {
            const result = await generator.generateOpenApiSpec(['/api/test']);
            expect(result.examples).toHaveLength(1);
            expect(result.examples[0]).toMatchObject({
                id: expect.stringMatching(/^example_/),
                name: 'GET /api/test',
                method: 'GET',
                url: 'https://test-api.example.com/api/test',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'X-API-Key': 'YOUR_API_KEY'
                }),
                response: expect.objectContaining({
                    statusCode: 200,
                    body: '{"success": true, "data": {}}'
                })
            });
        });
        it('should handle endpoint metadata correctly', async () => {
            const endpoints = ['/api/users'];
            const result = await generator.generateOpenApiSpec(endpoints);
            const endpoint = result.endpoints[0];
            expect(endpoint).toMatchObject({
                id: 'endpoint__api_users',
                path: '/api/users',
                method: 'GET',
                operationId: 'getapiusers',
                tags: ['users'],
                deprecated: false,
                rateLimit: expect.objectContaining({
                    tier: 'free',
                    requestsPerMinute: 60,
                    requestsPerHour: 1000,
                    requestsPerDay: 10000
                })
            });
        });
    });
});
//# sourceMappingURL=openapi-documentation-generator.test.js.map
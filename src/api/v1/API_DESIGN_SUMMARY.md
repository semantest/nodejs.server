# Semantest API Design Summary

## Overview
Complete API design for Semantest image generation platform with async job processing and addon serving.

## Core Components

### 1. Image Generation API (`/api/v1/`)

#### Primary Endpoint - NewChatRequested (#23)
```typescript
POST /api/v1/chat/new
```
- Creates new chat session with optional async image generation
- Returns chat response + job ID for image generation
- Supports webhook callbacks for job status updates

#### Key Features
- **Async Processing**: BullMQ + Redis job queue
- **Multi-Provider**: DALL-E 3/2, Stable Diffusion, Midjourney
- **Rate Limiting**: Per-endpoint limits with headers
- **Webhooks**: Real-time job status updates
- **Health Monitoring**: `/api/v1/health` endpoint

#### Job Flow
1. Client sends request to `/chat/new` or `/images/generate`
2. Server creates job, returns job ID immediately (202 Accepted)
3. Client polls `/images/status/{jobId}` OR receives webhook
4. Images delivered with CDN URLs and metadata

### 2. Addon Serving API (`/api/v1/addons/`)

#### Phase 1 - Simple Static Serving
```
GET /api/v1/addons/{addonId}
```
- Returns JavaScript/CSS content
- ETag and Last-Modified caching
- Version management via query params

#### Phase 2 - Domain-Based Injection
- Domain pattern matching
- Dynamic bundling for performance
- Dependency resolution

### 3. Technical Stack

#### Dependencies
- **Framework**: Express.js with TypeScript
- **Queue**: BullMQ (Redis-backed)
- **Validation**: Zod schemas
- **Docs**: OpenAPI 3.0
- **Auth**: JWT + API Keys

#### Required Infrastructure
- Redis instance for job queue
- S3/CDN for image storage
- PostgreSQL for metadata
- External APIs: OpenAI, Stability AI, Midjourney

## API Contract Locations

- **TypeScript Schemas**: `/src/api/v1/schemas/`
  - `image-generation-api.schema.ts`
  - `addon-api.schema.ts`
  
- **OpenAPI Spec**: `/src/api/v1/openapi/image-generation-api.yaml`

- **Route Implementations**: `/src/api/v1/routes/`
  - `image-generation.routes.ts`
  - `addon.routes.ts`

## Integration Points

### For Eva (Browser Extension)
- Use `NewChatRequest` schema for chat + image requests
- Poll job status endpoint or implement webhook listener
- Fetch addons via simple GET with caching headers

### For Quinn (QA)
- Test async job flow end-to-end
- Verify webhook delivery reliability
- Test rate limiting behavior
- Validate error scenarios and retries

### For Dana (DevOps)
- Set up Redis cluster for job queue
- Configure S3 buckets for image storage
- Set up monitoring for queue depth and job failures
- Implement CDN for addon delivery

### For Aria (Architecture)
- Review multi-provider abstraction design
- Validate scaling approach for job workers
- Review caching strategy for addons

## Next Steps

1. **Implement provider interfaces** (DalleProvider, StableDiffusionProvider, etc.)
2. **Set up job worker pool** with proper concurrency limits
3. **Create integration tests** for full async flow
4. **Deploy Redis** and configure BullMQ connection
5. **Implement webhook delivery** service with retries

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/chat/new` | 10 req | 1 min |
| `/images/generate` | 30 req | 1 min |
| `/images/batch` | 5 req | 1 min |
| `/images/status/*` | 120 req | 1 min |
| `/addons/*` | 1000 req | 1 min |

## Error Codes

- `VALIDATION_ERROR`: Invalid request body
- `RATE_LIMITED`: Too many requests
- `JOB_NOT_FOUND`: Invalid job ID
- `GENERATION_FAILED`: Provider error
- `ADDON_NOT_FOUND`: Invalid addon ID
- `DOMAIN_NOT_ALLOWED`: Domain restriction

---

Ready for implementation! Questions? Contact Alex in window 1 🚀
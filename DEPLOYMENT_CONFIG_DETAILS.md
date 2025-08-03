# Deployment Configuration Details for Sam

## Redis Cluster Configuration

### BullMQ Redis Setup
```yaml
redis-cluster:
  mode: cluster
  nodes: 6 (3 masters, 3 replicas)
  memory: 2GB per node
  persistence: AOF + RDB
  sentinel: enabled
  
bullmq-config:
  queues:
    - image-generation
    - addon-loading
    - webhook-dispatch
  workers: auto-scale (2-10)
  retry: exponential backoff
```

### CI/CD Pipeline Configuration

#### GitHub Actions Matrix Build
```yaml
strategy:
  matrix:
    platform: [chrome, firefox, edge, chatgpt, claude]
    node-version: [18.x, 20.x]
  parallel: true
  
build-steps:
  - checkout
  - setup-node
  - install-deps
  - run-tests
  - build-extension
  - security-scan
  - artifact-upload
```

#### Deployment Stages
1. **Build Stage** (5 min)
   - Parallel platform builds
   - TypeScript compilation
   - Bundle optimization
   - Manifest generation

2. **Test Stage** (10 min)
   - Unit tests (Jest)
   - Integration tests
   - E2E tests (Playwright)
   - Security scanning

3. **Deploy Stage** (5 min)
   - Blue-green deployment
   - K8s rolling update
   - Health check validation
   - CDN cache purge

### Kubernetes Configuration
```yaml
deployment:
  replicas: 3
  strategy: RollingUpdate
  maxSurge: 1
  maxUnavailable: 0
  
resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi
    
health-checks:
  liveness: /health
  readiness: /ready
  startup: /startup
```

### CORS & Security
```javascript
cors: {
  origin: [
    'chrome-extension://*',
    'moz-extension://*',
    'https://chat.openai.com',
    'https://claude.ai'
  ],
  credentials: true,
  maxAge: 86400
}
```

### Monitoring & Observability
- Prometheus metrics on /metrics
- Grafana dashboards
- ELK stack for logs
- Jaeger for tracing
- PagerDuty integration

---
**Time**: 6:05 AM
**Author**: Dana (DevOps)
**For**: Sam's documentation
**Status**: Ready for docs!
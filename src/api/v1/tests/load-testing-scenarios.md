# Load Testing Scenarios for Metaphysical Integration

## Overview
This document outlines load testing scenarios to ensure the Semantest API can handle increased traffic from Metaphysical integration.

## Expected Load Profile

### Baseline (Current)
- 100 requests/minute
- 10 concurrent users
- Average response time: <500ms

### Metaphysical Integration (Expected)
- 1000 requests/minute (10x increase)
- 50 concurrent users
- Target response time: <1000ms
- Peak hours: 9 AM - 6 PM PST

## Test Scenarios

### 1. Ramp-Up Test
**Objective**: Test system behavior under gradually increasing load

```yaml
scenario: ramp_up_test
duration: 30 minutes
stages:
  - duration: 5m
    target: 10 users
  - duration: 10m
    target: 25 users
  - duration: 10m
    target: 50 users
  - duration: 5m
    target: 10 users
```

### 2. Spike Test
**Objective**: Test system response to sudden traffic spikes

```yaml
scenario: spike_test
duration: 15 minutes
stages:
  - duration: 2m
    target: 10 users
  - duration: 1m
    target: 100 users  # Sudden spike
  - duration: 5m
    target: 100 users  # Sustained high load
  - duration: 2m
    target: 10 users
```

### 3. Endurance Test
**Objective**: Test system stability over extended periods

```yaml
scenario: endurance_test
duration: 2 hours
stages:
  - duration: 10m
    target: 50 users
  - duration: 100m
    target: 50 users  # Sustained load
  - duration: 10m
    target: 0 users
```

### 4. Batch Processing Test
**Objective**: Test batch image generation capabilities

```yaml
scenario: batch_processing
duration: 30 minutes
virtual_users: 20
actions:
  - name: batch_generate
    weight: 70%
    payload:
      jobs: 5-10 images per batch
  - name: single_generate
    weight: 30%
    payload:
      count: 1-4 images
```

## K6 Test Scripts

### Basic Load Test
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '10m', target: 50 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    errors: ['rate<0.05'], // Error rate under 5%
  },
};

const BASE_URL = 'https://api.semantest.com/api/v1';
const API_KEY = __ENV.METAPHYSICAL_API_KEY;

export default function () {
  // Test 1: Single image generation
  const singleImageRes = http.post(
    `${BASE_URL}/images/generate`,
    JSON.stringify({
      userId: `load-test-${__VU}-${__ITER}`,
      prompt: 'A futuristic cityscape with floating buildings',
      size: '1024x1024',
      provider: 'auto',
      quality: 'hd',
      count: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  check(singleImageRes, {
    'single image status 202': (r) => r.status === 202,
    'single image has jobId': (r) => r.json('jobId') !== undefined,
  });

  errorRate.add(singleImageRes.status !== 202);

  sleep(1);

  // Test 2: Batch generation
  if (__ITER % 5 === 0) { // Every 5th iteration
    const batchRes = http.post(
      `${BASE_URL}/images/batch`,
      JSON.stringify({
        userId: `load-test-batch-${__VU}`,
        jobs: [
          {
            prompt: 'Abstract digital art',
            size: '1024x1024',
            provider: 'stable-diffusion',
            count: 2,
          },
          {
            prompt: 'Cyberpunk street scene',
            size: '1792x1024',
            provider: 'dalle',
            count: 1,
          },
        ],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    check(batchRes, {
      'batch status 202': (r) => r.status === 202,
      'batch has batchId': (r) => r.json('batchId') !== undefined,
    });

    errorRate.add(batchRes.status !== 202);
  }

  sleep(2);
}
```

### WebSocket Load Test
```javascript
import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const url = 'wss://api.semantest.com/ws';
  const params = { 
    headers: { 
      'Authorization': `Bearer ${__ENV.METAPHYSICAL_API_KEY}` 
    } 
  };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'subscribe',
        sessionId: `load-test-${__VU}`,
        events: ['image.progress', 'image.completed']
      }));
    });

    socket.on('message', (data) => {
      const message = JSON.parse(data);
      check(message, {
        'received valid message': (m) => m.type !== undefined,
      });
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000); // 30 seconds per connection
  });

  check(res, { 'WebSocket connected': (r) => r && r.status === 101 });
}
```

## Monitoring During Tests

### Key Metrics to Track
1. **Response Time**
   - p50, p95, p99 percentiles
   - Average response time
   - Max response time

2. **Throughput**
   - Requests per second
   - Successful requests
   - Failed requests

3. **System Resources**
   - CPU utilization
   - Memory usage
   - Database connections
   - Redis memory

4. **Application Metrics**
   - Queue depth (BullMQ)
   - Provider response times
   - Cache hit rates
   - WebSocket connections

### Grafana Dashboard Queries
```sql
-- Response time percentiles
histogram_quantile(0.95, 
  sum(rate(http_request_duration_seconds_bucket[5m])) 
  by (le, endpoint)
)

-- Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) 
/ 
sum(rate(http_requests_total[5m]))

-- Active WebSocket connections
semantest_websocket_active_connections

-- Queue depth
semantest_bullmq_queue_depth{queue="image-generation"}
```

## Success Criteria

### Performance
- [ ] 95% of requests complete under 1000ms
- [ ] 99% of requests complete under 2000ms
- [ ] Error rate stays below 5%
- [ ] No memory leaks during 2-hour test

### Scalability
- [ ] System handles 1000 req/min smoothly
- [ ] Auto-scaling triggers appropriately
- [ ] Database connection pool doesn't exhaust
- [ ] Redis memory usage stays under 80%

### Reliability
- [ ] No provider timeouts under load
- [ ] Graceful degradation when limits reached
- [ ] Proper error messages returned
- [ ] WebSocket connections remain stable

## Pre-Test Checklist

1. **Infrastructure**
   - [ ] Kubernetes HPA configured
   - [ ] Database connection pool sized appropriately
   - [ ] Redis cluster has sufficient memory
   - [ ] CDN configured for static assets

2. **Application**
   - [ ] Rate limiting configured
   - [ ] Circuit breakers enabled
   - [ ] Logging level set appropriately
   - [ ] Monitoring alerts configured

3. **Test Environment**
   - [ ] Staging environment mirrors production
   - [ ] Test data prepared
   - [ ] Load testing tools installed
   - [ ] Monitoring dashboards ready

## Running the Tests

```bash
# Install k6
brew install k6

# Run single scenario
k6 run --vus 50 --duration 30m load-test.js

# Run with environment variables
k6 run -e METAPHYSICAL_API_KEY=$API_KEY \
       -e BASE_URL=https://staging.semantest.com \
       load-test.js

# Run with output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 load-test.js
```

## Post-Test Analysis

1. **Generate Report**
   - Response time distribution
   - Error analysis
   - Resource utilization graphs
   - Bottleneck identification

2. **Action Items**
   - Scale infrastructure if needed
   - Optimize slow endpoints
   - Adjust rate limits
   - Update documentation

---

**Note**: These scenarios should be run in staging first, then adjusted based on results before production testing.
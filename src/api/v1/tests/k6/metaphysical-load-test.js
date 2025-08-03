/**
 * @fileoverview Metaphysical Integration Load Test
 * @description K6 load test script for testing Semantest API under Metaphysical load
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const imageGenDuration = new Trend('image_generation_duration');
const batchGenDuration = new Trend('batch_generation_duration');
const webhookDeliveryTime = new Trend('webhook_delivery_time');

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up
    gradual_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 20 },  // Warm up
        { duration: '10m', target: 50 }, // Normal load
        { duration: '10m', target: 100 }, // Peak load
        { duration: '5m', target: 0 },   // Cool down
      ],
      gracefulRampDown: '30s',
    },
    // Scenario 2: Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '30s', target: 150 }, // Sudden spike
        { duration: '3m', target: 150 },  // Sustained spike
        { duration: '30s', target: 10 },
      ],
      gracefulRampDown: '30s',
      startTime: '35m', // Start after gradual load test
    },
    // Scenario 3: Constant batch processing
    batch_processing: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30m',
      startTime: '45m', // Start after spike test
    },
  },
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    
    // Custom metric thresholds
    errors: ['rate<0.05'], // 5% error rate
    image_generation_duration: ['p(95)<5000'], // 95% under 5s
    batch_generation_duration: ['p(95)<10000'], // 95% under 10s
    
    // Specific endpoint thresholds
    'http_req_duration{endpoint:image_generate}': ['p(95)<1500'],
    'http_req_duration{endpoint:batch_generate}': ['p(95)<2000'],
    'http_req_duration{endpoint:status_check}': ['p(95)<200'],
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.semantest.com/api/v1';
const API_KEY = __ENV.METAPHYSICAL_API_KEY || 'test-key';
const WEBHOOK_URL = __ENV.WEBHOOK_URL || 'https://webhook.site/test';

// Helper functions
function generateImagePrompt() {
  const prompts = [
    'A futuristic cityscape with floating buildings and neon lights',
    'Abstract digital art with vibrant colors and geometric shapes',
    'Cyberpunk street scene with holographic advertisements',
    'Ethereal landscape with crystalline structures and aurora',
    'Steampunk machinery with intricate gears and brass components',
    'Surreal dreamscape with impossible architecture',
    'Bioluminescent forest with magical creatures',
    'Retro-futuristic space station interior',
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

// Main test function
export default function() {
  const userId = `metaphysical-load-test-${__VU}-${__ITER}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Request-ID': randomString(32),
  };

  group('Single Image Generation', () => {
    const startTime = new Date();
    
    const payload = JSON.stringify({
      userId: userId,
      prompt: generateImagePrompt(),
      size: ['1024x1024', '1792x1024', '1024x1792'][Math.floor(Math.random() * 3)],
      provider: ['dalle', 'stable-diffusion', 'auto'][Math.floor(Math.random() * 3)],
      quality: 'hd',
      count: Math.floor(Math.random() * 3) + 1,
      webhookUrl: WEBHOOK_URL,
      metadata: {
        test: 'load-test',
        scenario: 'metaphysical',
        timestamp: new Date().toISOString(),
      },
    });

    const res = http.post(`${BASE_URL}/images/generate`, payload, {
      headers: headers,
      tags: { endpoint: 'image_generate' },
    });

    // Check response
    const success = check(res, {
      'status is 202': (r) => r.status === 202,
      'has jobId': (r) => r.json('jobId') !== undefined,
      'has statusUrl': (r) => r.json('statusUrl') !== undefined,
    });

    errorRate.add(!success);

    if (success && res.json('jobId')) {
      const duration = new Date() - startTime;
      imageGenDuration.add(duration);

      // Poll job status
      sleep(2);
      const statusUrl = `${BASE_URL}/images/status/${res.json('jobId')}`;
      const statusRes = http.get(statusUrl, {
        headers: headers,
        tags: { endpoint: 'status_check' },
      });

      check(statusRes, {
        'status check successful': (r) => r.status === 200,
        'has job status': (r) => r.json('status') !== undefined,
      });
    }
  });

  sleep(Math.random() * 2 + 1);

  // Batch processing (every 5th iteration)
  if (__ITER % 5 === 0) {
    group('Batch Image Generation', () => {
      const startTime = new Date();
      
      const jobs = [];
      const jobCount = Math.floor(Math.random() * 4) + 2; // 2-5 jobs
      
      for (let i = 0; i < jobCount; i++) {
        jobs.push({
          prompt: generateImagePrompt(),
          size: '1024x1024',
          provider: i % 2 === 0 ? 'dalle' : 'stable-diffusion',
          count: Math.floor(Math.random() * 2) + 1,
          metadata: {
            batchIndex: i,
            test: 'batch-load-test',
          },
        });
      }

      const batchPayload = JSON.stringify({
        userId: userId,
        webhookUrl: WEBHOOK_URL,
        jobs: jobs,
      });

      const res = http.post(`${BASE_URL}/images/batch`, batchPayload, {
        headers: headers,
        tags: { endpoint: 'batch_generate' },
      });

      const success = check(res, {
        'batch status is 202': (r) => r.status === 202,
        'has batchId': (r) => r.json('batchId') !== undefined,
        'has correct job count': (r) => r.json('totalJobs') === jobs.length,
      });

      errorRate.add(!success);

      if (success) {
        const duration = new Date() - startTime;
        batchGenDuration.add(duration);
      }
    });
  }

  sleep(Math.random() * 3 + 2);

  // Provider health check (every 10th iteration)
  if (__ITER % 10 === 0) {
    group('Provider Health Check', () => {
      const res = http.get(`${BASE_URL}/providers`, {
        headers: headers,
        tags: { endpoint: 'provider_list' },
      });

      check(res, {
        'providers list successful': (r) => r.status === 200,
        'has providers': (r) => Array.isArray(r.json()) && r.json().length > 0,
      });
    });
  }
}

// Handle test lifecycle
export function setup() {
  console.log('🚀 Starting Metaphysical load test');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);
  
  // Verify API is accessible
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API health check failed: ${res.status}`);
  }
  
  return { startTime: new Date() };
}

export function teardown(data) {
  console.log('✅ Load test completed');
  console.log(`⏱️  Duration: ${(new Date() - data.startTime) / 1000}s`);
}

// Custom handleSummary for better reporting
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'metaphysical-load-test-results.json': JSON.stringify(data, null, 2),
    'metaphysical-load-test-results.html': htmlReport(data),
  };
}

function textSummary(data, options) {
  // Custom text summary implementation
  let summary = '\n=== Metaphysical Load Test Results ===\n\n';
  
  // Add key metrics
  if (data.metrics) {
    summary += 'Key Metrics:\n';
    summary += `- Error Rate: ${(data.metrics.errors.rate * 100).toFixed(2)}%\n`;
    summary += `- Avg Response Time: ${data.metrics.http_req_duration.avg.toFixed(0)}ms\n`;
    summary += `- 95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(0)}ms\n`;
    summary += `- Total Requests: ${data.metrics.http_reqs.count}\n`;
  }
  
  return summary;
}

function htmlReport(data) {
  // Basic HTML report template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Metaphysical Load Test Results</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { margin: 20px 0; padding: 20px; background: #f0f0f0; }
        .success { color: green; }
        .failure { color: red; }
      </style>
    </head>
    <body>
      <h1>Metaphysical Load Test Results</h1>
      <div class="metric">
        <h2>Summary</h2>
        <p>Total Requests: ${data.metrics.http_reqs.count}</p>
        <p>Error Rate: ${(data.metrics.errors.rate * 100).toFixed(2)}%</p>
        <p>Average Response Time: ${data.metrics.http_req_duration.avg.toFixed(0)}ms</p>
      </div>
    </body>
    </html>
  `;
}
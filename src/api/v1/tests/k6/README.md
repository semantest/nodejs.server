# K6 Load Testing for Metaphysical Integration

This directory contains load testing scripts for the Semantest API, specifically designed to validate our readiness for the Metaphysical integration.

## Quick Start

### Prerequisites
- K6 installed (`brew install k6` on macOS)
- Docker & Docker Compose (for containerized testing)
- Metaphysical API key

### Running Tests

#### Local Execution
```bash
# Set your API key
export METAPHYSICAL_API_KEY="your-api-key"

# Run smoke test (quick validation)
./run-load-tests.sh smoke

# Run gradual load test
./run-load-tests.sh gradual

# Run spike test
./run-load-tests.sh spike

# Run all tests (except endurance)
./run-load-tests.sh all
```

#### Docker Execution
```bash
# Build and run with monitoring stack
docker-compose up --build

# View metrics at http://localhost:3000 (Grafana)
```

## Test Scenarios

1. **Smoke Test** - Quick validation (5 VUs, 1 minute)
2. **Gradual Load** - Ramp up to 100 VUs over 30 minutes
3. **Spike Test** - Sudden traffic spike to 150 VUs
4. **Endurance Test** - Sustained load for 2 hours

## Files

- `metaphysical-load-test.js` - Main K6 test script
- `run-load-tests.sh` - Test execution helper
- `docker-compose.yml` - Full monitoring stack
- `Dockerfile` - K6 test container

## Monitoring

Results are saved in the `./results` directory:
- JSON output for detailed analysis
- HTML reports for quick overview
- InfluxDB metrics (when using Docker)

## Success Criteria

- ✅ 95% of requests < 1000ms
- ✅ Error rate < 5%
- ✅ No memory leaks during endurance test
- ✅ Graceful handling of 10x traffic increase

---
*Created by Alex - Backend Specialist | Semantest Team*
#!/bin/bash
# Metaphysical Integration Load Test Runner
# Author: Alex - Semantest Team

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${BASE_URL:-https://api.semantest.com/api/v1}"
METAPHYSICAL_API_KEY="${METAPHYSICAL_API_KEY}"
WEBHOOK_URL="${WEBHOOK_URL:-https://webhook.site/test}"
SCENARIO="${1:-all}"
OUTPUT_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Print banner
echo -e "${BLUE}🚀 Metaphysical Load Test Runner${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if API key is provided
if [ -z "$METAPHYSICAL_API_KEY" ]; then
    echo -e "${RED}❌ Error: METAPHYSICAL_API_KEY environment variable not set${NC}"
    echo "Usage: METAPHYSICAL_API_KEY=your-key ./run-load-tests.sh [scenario]"
    exit 1
fi

# Create results directory
mkdir -p "$OUTPUT_DIR"

# Function to run a specific scenario
run_scenario() {
    local scenario_name=$1
    local k6_options=$2
    
    echo -e "${YELLOW}📊 Running scenario: ${scenario_name}${NC}"
    echo -e "${YELLOW}Options: ${k6_options}${NC}"
    echo ""
    
    k6 run \
        -e BASE_URL="$BASE_URL" \
        -e METAPHYSICAL_API_KEY="$METAPHYSICAL_API_KEY" \
        -e WEBHOOK_URL="$WEBHOOK_URL" \
        --out json="$OUTPUT_DIR/${scenario_name}_${TIMESTAMP}.json" \
        --summary-export="$OUTPUT_DIR/${scenario_name}_${TIMESTAMP}_summary.json" \
        $k6_options \
        metaphysical-load-test.js
    
    echo -e "${GREEN}✅ Scenario ${scenario_name} completed${NC}"
    echo ""
}

# Function to run quick smoke test
run_smoke_test() {
    echo -e "${BLUE}🔥 Running smoke test (quick validation)${NC}"
    run_scenario "smoke" "--vus 5 --duration 1m"
}

# Function to run gradual load test
run_gradual_load() {
    echo -e "${BLUE}📈 Running gradual load test${NC}"
    run_scenario "gradual" "--config metaphysical-load-test.js"
}

# Function to run spike test
run_spike_test() {
    echo -e "${BLUE}⚡ Running spike test${NC}"
    # Custom options for spike test only
    k6 run \
        -e BASE_URL="$BASE_URL" \
        -e METAPHYSICAL_API_KEY="$METAPHYSICAL_API_KEY" \
        -e WEBHOOK_URL="$WEBHOOK_URL" \
        --out json="$OUTPUT_DIR/spike_${TIMESTAMP}.json" \
        --scenario spike_test \
        metaphysical-load-test.js
}

# Function to run endurance test
run_endurance_test() {
    echo -e "${BLUE}⏱️  Running endurance test (2 hours)${NC}"
    echo -e "${YELLOW}⚠️  This will take approximately 2 hours${NC}"
    run_scenario "endurance" "--vus 50 --duration 2h"
}

# Function to generate report
generate_report() {
    echo -e "${BLUE}📄 Generating HTML report${NC}"
    
    # Create consolidated report
    cat > "$OUTPUT_DIR/report_${TIMESTAMP}.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Metaphysical Load Test Report - ${TIMESTAMP}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 30px; }
        .metric { 
            display: inline-block; 
            margin: 20px 20px 20px 0; 
            padding: 20px; 
            background: #f9f9f9; 
            border-left: 4px solid #4CAF50;
            min-width: 200px;
        }
        .metric-label { font-size: 14px; color: #666; }
        .metric-value { font-size: 28px; font-weight: bold; color: #333; }
        .success { color: #4CAF50; }
        .warning { color: #FF9800; }
        .failure { color: #f44336; }
        .scenario { 
            margin: 20px 0; 
            padding: 20px; 
            background: #f0f7ff; 
            border-radius: 5px;
        }
        pre { background: #f5f5f5; padding: 15px; overflow-x: auto; }
        .timestamp { color: #999; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Metaphysical Load Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
        
        <h2>Test Configuration</h2>
        <div class="scenario">
            <p><strong>Target URL:</strong> ${BASE_URL}</p>
            <p><strong>Scenario:</strong> ${SCENARIO}</p>
            <p><strong>Duration:</strong> See individual scenarios</p>
        </div>
        
        <h2>Key Metrics</h2>
        <div class="metrics">
            <!-- Metrics will be populated by K6 results -->
            <div class="metric">
                <div class="metric-label">Total Requests</div>
                <div class="metric-value">-</div>
            </div>
            <div class="metric">
                <div class="metric-label">Error Rate</div>
                <div class="metric-value">-</div>
            </div>
            <div class="metric">
                <div class="metric-label">Avg Response Time</div>
                <div class="metric-value">-</div>
            </div>
            <div class="metric">
                <div class="metric-label">95th Percentile</div>
                <div class="metric-value">-</div>
            </div>
        </div>
        
        <h2>Recommendations</h2>
        <ul>
            <li>Monitor error rates during peak hours</li>
            <li>Scale infrastructure if response times exceed 1s</li>
            <li>Review failed requests for patterns</li>
            <li>Consider implementing caching for repeated requests</li>
        </ul>
    </div>
</body>
</html>
EOF
    
    echo -e "${GREEN}✅ Report generated: $OUTPUT_DIR/report_${TIMESTAMP}.html${NC}"
}

# Main execution logic
case "$SCENARIO" in
    "smoke")
        run_smoke_test
        ;;
    "gradual")
        run_gradual_load
        ;;
    "spike")
        run_spike_test
        ;;
    "endurance")
        run_endurance_test
        ;;
    "all")
        echo -e "${BLUE}🎯 Running all test scenarios${NC}"
        echo ""
        run_smoke_test
        run_gradual_load
        run_spike_test
        echo -e "${YELLOW}⚠️  Skipping endurance test (use './run-load-tests.sh endurance' to run separately)${NC}"
        ;;
    *)
        echo -e "${RED}❌ Unknown scenario: $SCENARIO${NC}"
        echo "Available scenarios: smoke, gradual, spike, endurance, all"
        exit 1
        ;;
esac

# Generate report
generate_report

# Print summary
echo -e "${GREEN}🎉 Load testing completed!${NC}"
echo -e "${GREEN}Results saved in: $OUTPUT_DIR${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the HTML report: $OUTPUT_DIR/report_${TIMESTAMP}.html"
echo "2. Analyze JSON results for detailed metrics"
echo "3. Import results into Grafana for visualization"
echo "4. Share findings with the Metaphysical team"

# Check if running in Docker
if [ -f /.dockerenv ]; then
    echo ""
    echo -e "${YELLOW}📊 View real-time metrics at: http://localhost:3000 (Grafana)${NC}"
fi
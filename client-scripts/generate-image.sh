#!/bin/bash

# Fire-and-forget export request script
# Sends export requests without waiting for response to test queue capacity

# Default values
SERVER_URL="http://localhost:4001"
EXPORT_TYPE="report"
EXPORT_FORMAT="pdf"
USER_ID="test-user-123"
ORG_ID="test-org-456"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --server)
      SERVER_URL="$2"
      shift 2
      ;;
    --type)
      EXPORT_TYPE="$2"
      shift 2
      ;;
    --format)
      EXPORT_FORMAT="$2"
      shift 2
      ;;
    --user)
      USER_ID="$2"
      shift 2
      ;;
    --org)
      ORG_ID="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --server URL     Server URL (default: http://localhost:4001)"
      echo "  --type TYPE      Export type: report|dashboard|query (default: report)"
      echo "  --format FORMAT  Export format: pdf|csv|json|excel|xml (default: pdf)"
      echo "  --user ID        User ID (default: test-user-123)"
      echo "  --org ID         Organization ID (default: test-org-456)"
      echo "  --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Generate a sample analytics query as the source
QUERY_SOURCE=$(cat <<EOF
{
  "timeRange": {
    "start": "$(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%SZ')",
    "end": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  },
  "metrics": ["page_views", "unique_users", "session_duration"],
  "dimensions": ["page", "country", "device_type"],
  "filters": {
    "eventType": ["page_view", "click", "form_submit"]
  },
  "aggregations": {
    "sum": ["page_views"],
    "avg": ["session_duration"],
    "count": ["unique_users"]
  }
}
EOF
)

# Create the export request payload
PAYLOAD=$(cat <<EOF
{
  "type": "$EXPORT_TYPE",
  "format": "$EXPORT_FORMAT",
  "source": $QUERY_SOURCE,
  "userId": "$USER_ID",
  "organizationId": "$ORG_ID",
  "options": {
    "includeCharts": true,
    "includeRawData": true,
    "includeMetadata": true,
    "compressed": false,
    "fileName": "analytics-export-$(date +%s)",
    "branding": {
      "companyName": "Test Company",
      "colors": {
        "primary": "#007bff",
        "secondary": "#6c757d"
      }
    }
  }
}
EOF
)

# Send the request without waiting for response
# Using curl with timeout and background execution
echo "Sending export request to $SERVER_URL/api/exports..."
echo "Type: $EXPORT_TYPE, Format: $EXPORT_FORMAT"

# Fire and forget - send to background with minimal timeout
curl -X POST "$SERVER_URL/api/exports" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --max-time 0.1 \
  --connect-timeout 0.1 \
  > /dev/null 2>&1 &

# Get the PID of the background curl process
CURL_PID=$!

# Immediately disown the process so script can exit
disown $CURL_PID

echo "Request sent (PID: $CURL_PID) - not waiting for response"
echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Exit immediately without waiting
exit 0
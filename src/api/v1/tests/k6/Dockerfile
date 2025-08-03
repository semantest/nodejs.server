# K6 Load Testing Docker Image
# For running Metaphysical integration load tests

FROM grafana/k6:latest

# Install additional dependencies
RUN apk add --no-cache \
    bash \
    curl \
    jq

# Create working directory
WORKDIR /scripts

# Copy load test scripts
COPY *.js ./

# Create results directory
RUN mkdir -p /results

# Default environment variables
ENV BASE_URL=https://api.semantest.com/api/v1
ENV METAPHYSICAL_API_KEY=""
ENV WEBHOOK_URL=https://webhook.site/test

# Entry point for running tests
ENTRYPOINT ["k6"]

# Default command runs the main load test
CMD ["run", "--out", "json=/results/results.json", "metaphysical-load-test.js"]
#!/bin/bash
# Production Deployment Script for Semantest API
# Supports Docker Compose and Kubernetes deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-docker}
VERSION=${2:-latest}
REGISTRY=${DOCKER_REGISTRY:-"docker.io/semantest"}

echo -e "${GREEN}Semantest Production Deployment Script${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Version: ${YELLOW}$VERSION${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    if [[ "$ENVIRONMENT" == "docker" ]]; then
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}Docker is not installed${NC}"
            exit 1
        fi
        if ! command -v docker-compose &> /dev/null; then
            echo -e "${RED}Docker Compose is not installed${NC}"
            exit 1
        fi
    elif [[ "$ENVIRONMENT" == "k8s" ]] || [[ "$ENVIRONMENT" == "kubernetes" ]]; then
        if ! command -v kubectl &> /dev/null; then
            echo -e "${RED}kubectl is not installed${NC}"
            exit 1
        fi
        if ! kubectl cluster-info &> /dev/null; then
            echo -e "${RED}kubectl is not connected to a cluster${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}Prerequisites check passed${NC}"
}

# Function to build Docker images
build_images() {
    echo -e "\n${YELLOW}Building Docker images...${NC}"
    
    # Build API image
    echo -e "Building API image..."
    docker build -f Dockerfile.production -t $REGISTRY/api:$VERSION .
    
    # Build WebSocket image (if separate Dockerfile exists)
    if [ -f "Dockerfile.websocket" ]; then
        echo -e "Building WebSocket image..."
        docker build -f Dockerfile.websocket -t $REGISTRY/websocket:$VERSION .
    else
        # Use same image for WebSocket if no separate Dockerfile
        docker tag $REGISTRY/api:$VERSION $REGISTRY/websocket:$VERSION
    fi
    
    # Build Worker image (if separate Dockerfile exists)
    if [ -f "Dockerfile.worker" ]; then
        echo -e "Building Worker image..."
        docker build -f Dockerfile.worker -t $REGISTRY/worker:$VERSION .
    else
        # Use same image for Worker if no separate Dockerfile
        docker tag $REGISTRY/api:$VERSION $REGISTRY/worker:$VERSION
    fi
    
    echo -e "${GREEN}Images built successfully${NC}"
}

# Function to push images to registry
push_images() {
    echo -e "\n${YELLOW}Pushing images to registry...${NC}"
    
    docker push $REGISTRY/api:$VERSION
    docker push $REGISTRY/websocket:$VERSION
    docker push $REGISTRY/worker:$VERSION
    
    # Also tag and push as latest
    docker tag $REGISTRY/api:$VERSION $REGISTRY/api:latest
    docker tag $REGISTRY/websocket:$VERSION $REGISTRY/websocket:latest
    docker tag $REGISTRY/worker:$VERSION $REGISTRY/worker:latest
    
    docker push $REGISTRY/api:latest
    docker push $REGISTRY/websocket:latest
    docker push $REGISTRY/worker:latest
    
    echo -e "${GREEN}Images pushed successfully${NC}"
}

# Function to deploy with Docker Compose
deploy_docker() {
    echo -e "\n${YELLOW}Deploying with Docker Compose...${NC}"
    
    # Check if .env file exists
    if [ ! -f ".env.production" ]; then
        echo -e "${RED}.env.production file not found${NC}"
        echo -e "Please create .env.production with required environment variables"
        exit 1
    fi
    
    # Load environment variables
    export $(cat .env.production | grep -v '^#' | xargs)
    
    # Pull latest images
    docker-compose -f docker-compose.production.yml pull
    
    # Deploy with zero-downtime (blue-green)
    echo -e "Starting green deployment..."
    docker-compose -f docker-compose.production.yml up -d api-green
    
    # Wait for green to be healthy
    echo -e "Waiting for green deployment to be healthy..."
    sleep 30
    
    # Check health
    if curl -f http://localhost:3001/api/v1/health; then
        echo -e "\n${GREEN}Green deployment is healthy${NC}"
        
        # Switch traffic to green
        echo -e "Switching traffic to green deployment..."
        # This would be done in nginx config or load balancer
        
        # Stop blue deployment
        echo -e "Stopping blue deployment..."
        docker-compose -f docker-compose.production.yml stop api-blue
        
        echo -e "${GREEN}Deployment completed successfully${NC}"
    else
        echo -e "\n${RED}Green deployment health check failed${NC}"
        docker-compose -f docker-compose.production.yml stop api-green
        exit 1
    fi
}

# Function to deploy with Kubernetes
deploy_kubernetes() {
    echo -e "\n${YELLOW}Deploying to Kubernetes...${NC}"
    
    # Update image tags in K8s manifests
    sed -i "s|image: semantest/api:.*|image: $REGISTRY/api:$VERSION|g" k8s-production.yaml
    sed -i "s|image: semantest/websocket:.*|image: $REGISTRY/websocket:$VERSION|g" k8s-production.yaml
    sed -i "s|image: semantest/worker:.*|image: $REGISTRY/worker:$VERSION|g" k8s-production.yaml
    
    # Apply K8s manifests
    echo -e "Applying Kubernetes manifests..."
    kubectl apply -f k8s-production.yaml
    
    # Wait for rollout to complete
    echo -e "Waiting for rollout to complete..."
    kubectl -n semantest-prod rollout status deployment/semantest-api
    kubectl -n semantest-prod rollout status deployment/semantest-websocket
    kubectl -n semantest-prod rollout status deployment/semantest-worker
    
    # Check pod status
    echo -e "\nPod Status:"
    kubectl -n semantest-prod get pods
    
    echo -e "${GREEN}Kubernetes deployment completed successfully${NC}"
}

# Function to run database migrations
run_migrations() {
    echo -e "\n${YELLOW}Running database migrations...${NC}"
    
    if [[ "$ENVIRONMENT" == "docker" ]]; then
        docker-compose -f docker-compose.production.yml run --rm api npm run migrate
    else
        kubectl -n semantest-prod run migration --rm -it --image=$REGISTRY/api:$VERSION --restart=Never -- npm run migrate
    fi
    
    echo -e "${GREEN}Migrations completed${NC}"
}

# Function to perform health checks
health_check() {
    echo -e "\n${YELLOW}Performing health checks...${NC}"
    
    if [[ "$ENVIRONMENT" == "docker" ]]; then
        HEALTH_URL="http://localhost:3000/api/v1/health"
    else
        # Get ingress URL for K8s
        HEALTH_URL="https://api.semantest.com/api/v1/health"
    fi
    
    if curl -f $HEALTH_URL; then
        echo -e "\n${GREEN}Health check passed${NC}"
    else
        echo -e "\n${RED}Health check failed${NC}"
        exit 1
    fi
}

# Function to show deployment info
show_info() {
    echo -e "\n${GREEN}Deployment Information:${NC}"
    
    if [[ "$ENVIRONMENT" == "docker" ]]; then
        echo -e "API URL: http://localhost:3000"
        echo -e "WebSocket URL: ws://localhost:8080"
        echo -e "\nServices:"
        docker-compose -f docker-compose.production.yml ps
    else
        echo -e "Namespace: semantest-prod"
        echo -e "\nServices:"
        kubectl -n semantest-prod get services
        echo -e "\nIngress:"
        kubectl -n semantest-prod get ingress
    fi
}

# Main deployment flow
main() {
    check_prerequisites
    
    # Build and push images
    read -p "Build and push images? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_images
        push_images
    fi
    
    # Run migrations
    read -p "Run database migrations? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migrations
    fi
    
    # Deploy
    if [[ "$ENVIRONMENT" == "docker" ]]; then
        deploy_docker
    elif [[ "$ENVIRONMENT" == "k8s" ]] || [[ "$ENVIRONMENT" == "kubernetes" ]]; then
        deploy_kubernetes
    else
        echo -e "${RED}Unknown environment: $ENVIRONMENT${NC}"
        echo -e "Usage: $0 [docker|k8s] [version]"
        exit 1
    fi
    
    # Health check
    sleep 10
    health_check
    
    # Show deployment info
    show_info
    
    echo -e "\n${GREEN}Deployment completed successfully!${NC}"
}

# Run main function
main
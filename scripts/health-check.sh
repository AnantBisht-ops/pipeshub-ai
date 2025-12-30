#!/bin/bash

#################################################
# Health Check Script for Multi-Tenant System
# Validates deployment success and system health
#################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
MAX_RETRIES=5
RETRY_DELAY=10

# API endpoints based on environment
if [ "$ENVIRONMENT" == "production" ]; then
    API_URL="https://api.pipeshub.ai"
    APP_URL="https://app.pipeshub.ai"
else
    API_URL="https://staging-api.pipeshub.ai"
    APP_URL="https://staging.pipeshub.ai"
fi

# Test results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     MULTI-TENANT SYSTEM HEALTH CHECK                ║"
echo "║     Environment: $ENVIRONMENT                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Function to perform health check
check_health() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    local retries=0

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -n "Checking $name... "

    while [ $retries -lt $MAX_RETRIES ]; do
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")

        if [ "$HTTP_STATUS" == "$expected_status" ]; then
            echo -e "${GREEN}✅ OK${NC} (Status: $HTTP_STATUS)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        fi

        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            echo -n "."
            sleep $RETRY_DELAY
        fi
    done

    echo -e "${RED}❌ FAILED${NC} (Status: $HTTP_STATUS, Expected: $expected_status)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    return 1
}

# Function to check API endpoint with auth
check_api_auth() {
    local name=$1
    local endpoint=$2
    local expected_status=${3:-200}

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -n "Checking $name... "

    # Use test token from environment
    AUTH_TOKEN=${API_TEST_TOKEN:-"test-token"}

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "X-Organization-Id: test-org" \
        "$API_URL$endpoint" || echo "000")

    if [ "$HTTP_STATUS" == "$expected_status" ]; then
        echo -e "${GREEN}✅ OK${NC} (Status: $HTTP_STATUS)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (Status: $HTTP_STATUS, Expected: $expected_status)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    local name=$1

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -n "Checking $name... "

    # Check MongoDB connection
    if mongosh --eval "db.version()" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ Connection failed${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to check Redis
check_redis() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -n "Checking Redis cache... "

    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))

        # Check cache keys
        KEY_COUNT=$(redis-cli DBSIZE | awk '{print $1}')
        echo "  Cache keys: $KEY_COUNT"
        return 0
    else
        echo -e "${RED}❌ Connection failed${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to check multi-tenancy features
check_multi_tenancy() {
    echo -e "\n${BLUE}[Multi-Tenancy Features]${NC}"

    # Check if organizations endpoint works
    check_api_auth "Organizations API" "/api/organizations"

    # Check if projects endpoint works
    check_api_auth "Projects API" "/api/projects"

    # Check organization switching
    check_api_auth "Organization Switch" "/api/auth/switch-organization" "401"

    # Check project context
    check_api_auth "Project Context" "/api/documents?projectId=test" "200"
}

# ==================== MAIN HEALTH CHECKS ====================

echo -e "${BLUE}[Basic Health Checks]${NC}"

# Check if services are responding
check_health "API Server" "$API_URL/health"
check_health "Frontend App" "$APP_URL"
check_health "API Version" "$API_URL/version"

echo -e "\n${BLUE}[Service Connectivity]${NC}"

# Check database connectivity
check_database "MongoDB"
check_redis

echo -e "\n${BLUE}[API Endpoints]${NC}"

# Check core API endpoints
check_api_auth "Documents API" "/api/documents"
check_api_auth "Conversations API" "/api/conversations"
check_api_auth "Search API" "/api/search?q=test"
check_api_auth "Users API" "/api/users/me"

# Check multi-tenancy specific features
check_multi_tenancy

echo -e "\n${BLUE}[Performance Metrics]${NC}"

# Check response times
echo -n "API Response Time: "
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/health")
if (( $(echo "$RESPONSE_TIME < 1" | bc -l) )); then
    echo -e "${GREEN}${RESPONSE_TIME}s ✅${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}${RESPONSE_TIME}s ⚠️${NC} (Slow response)"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check memory usage
echo -n "Memory Usage: "
if command -v free &> /dev/null; then
    MEM_USAGE=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')
    echo "$MEM_USAGE"
else
    echo "N/A"
fi

# Check disk usage
echo -n "Disk Usage: "
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}')
echo "$DISK_USAGE"

echo -e "\n${BLUE}[Migration Verification]${NC}"

# Verify migration was successful
echo -n "Checking migration status... "
MIGRATION_CHECK=$(mongosh --eval "db.projects.countDocuments()" 2>/dev/null | tail -1)
if [ "$MIGRATION_CHECK" -gt "0" ]; then
    echo -e "${GREEN}✅ Projects exist${NC} (Count: $MIGRATION_CHECK)"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  No projects found${NC}"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# ==================== SUMMARY ====================

echo ""
echo "═══════════════════════════════════════════════════════"
echo "HEALTH CHECK SUMMARY"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}✅ Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}❌ Failed: $FAILED_CHECKS${NC}"

# Calculate health score
HEALTH_SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo ""
echo -n "Health Score: $HEALTH_SCORE% - "

if [ $HEALTH_SCORE -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELLENT${NC}"
    EXIT_CODE=0
elif [ $HEALTH_SCORE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  GOOD (with warnings)${NC}"
    EXIT_CODE=0
elif [ $HEALTH_SCORE -ge 50 ]; then
    echo -e "${YELLOW}⚠️  DEGRADED${NC}"
    EXIT_CODE=1
else
    echo -e "${RED}❌ CRITICAL${NC}"
    EXIT_CODE=2
fi

# Provide recommendations if there are failures
if [ $FAILED_CHECKS -gt 0 ]; then
    echo ""
    echo "📝 Recommendations:"

    if ! check_health "API Server" "$API_URL/health" > /dev/null 2>&1; then
        echo "  • Check if backend services are running"
        echo "  • Review backend logs for errors"
    fi

    if ! check_redis > /dev/null 2>&1; then
        echo "  • Verify Redis is running and accessible"
        echo "  • Check Redis connection string"
    fi

    if [ $HEALTH_SCORE -lt 50 ]; then
        echo "  • Consider rolling back the deployment"
        echo "  • Check all service logs for errors"
    fi
fi

# Write health report
cat > health-report.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "total_checks": $TOTAL_CHECKS,
  "passed": $PASSED_CHECKS,
  "failed": $FAILED_CHECKS,
  "health_score": $HEALTH_SCORE,
  "status": "$([ $EXIT_CODE -eq 0 ] && echo 'healthy' || echo 'unhealthy')"
}
EOF

echo ""
echo "Health report saved to: health-report.json"
echo ""

exit $EXIT_CODE
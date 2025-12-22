#!/bin/bash

# Phase 2 Test: Desktop Auth Signup
echo "========================================"
echo "PHASE 2: SIGNUP ENDPOINT TEST"
echo "========================================"

BASE_URL="http://51.20.239.3:8088"

echo -e "\nTest 1: Signup with valid data"
curl -X POST $BASE_URL/api/v1/desktop/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "desktop-test-'$(date +%s)'@example.com",
    "password": "Test123!@#",
    "fullName": "Desktop Test User",
    "organizationName": "Desktop Test Org"
  }' | jq '.'

echo -e "\n\nTest 2: Signup with duplicate email (should fail)"
curl -X POST $BASE_URL/api/v1/desktop/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "fullName": "Duplicate User",
    "organizationName": "Duplicate Org"
  }' | jq '.'

echo -e "\n\nTest 3: Signup with weak password (should fail)"
curl -X POST $BASE_URL/api/v1/desktop/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "weak@example.com",
    "password": "weak",
    "fullName": "Weak Password",
    "organizationName": "Weak Org"
  }' | jq '.'

echo -e "\n\n========================================"
echo "PHASE 2 TESTING COMPLETE"
echo "========================================"

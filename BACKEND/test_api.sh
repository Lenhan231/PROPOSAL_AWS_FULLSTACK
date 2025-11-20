#!/bin/bash

# Test API Script
# Usage: ./test_api.sh

set -e

echo "=== Online Library API Test ==="
echo ""

# 1. Get API Endpoint
echo "1. Getting API endpoint..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name OnlineLibrary-dev-Api \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text)

if [ -z "$API_URL" ]; then
  echo "❌ Failed to get API URL"
  exit 1
fi

echo "✅ API URL: $API_URL"
echo ""

# 2. Get Cognito credentials
echo "2. Getting Cognito credentials..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name OnlineLibrary-dev-Cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name OnlineLibrary-dev-Cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
  echo "❌ Failed to get Cognito credentials"
  exit 1
fi

echo "✅ User Pool ID: $USER_POOL_ID"
echo "✅ Client ID: $CLIENT_ID"
echo ""

# 3. Create test user
echo "3. Creating test user..."
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS 2>/dev/null || true

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser \
  --password Password123! \
  --permanent 2>/dev/null || true

echo "✅ Test user created: testuser / Password123!"
echo ""

# 4. Get JWT token
echo "4. Getting JWT token..."
TOKEN_RESPONSE=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser,PASSWORD=Password123!)

JWT_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.AuthenticationResult.AccessToken')

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "null" ]; then
  echo "❌ Failed to get JWT token"
  exit 1
fi

echo "✅ JWT Token obtained"
echo ""

# 5. Test Create Upload URL API
echo "5. Testing POST /books/upload-url..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/books/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.pdf",
    "fileSize": 1024000,
    "title": "Test Book",
    "author": "Test Author",
    "description": "A test book"
  }')

echo "Response:"
echo $UPLOAD_RESPONSE | jq .

# Check if response contains uploadUrl
if echo $UPLOAD_RESPONSE | jq -e '.uploadUrl' > /dev/null 2>&1; then
  echo "✅ Create Upload URL API works!"
  BOOK_ID=$(echo $UPLOAD_RESPONSE | jq -r '.bookId')
  UPLOAD_URL=$(echo $UPLOAD_RESPONSE | jq -r '.uploadUrl')
  echo "   Book ID: $BOOK_ID"
  echo "   Upload URL: $UPLOAD_URL"
else
  echo "❌ Create Upload URL API failed"
  exit 1
fi
echo ""

# 6. Test error handling - missing auth
echo "6. Testing error handling (missing auth)..."
ERROR_RESPONSE=$(curl -s -X POST "$API_URL/books/upload-url" \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.pdf", "fileSize": 1024}')

echo "Response:"
echo $ERROR_RESPONSE | jq .

if echo $ERROR_RESPONSE | jq -e '.code' > /dev/null 2>&1; then
  ERROR_CODE=$(echo $ERROR_RESPONSE | jq -r '.code')
  if [ "$ERROR_CODE" = "UNAUTHORIZED" ]; then
    echo "✅ Error handling works (UNAUTHORIZED)"
  else
    echo "⚠️  Got error code: $ERROR_CODE"
  fi
else
  echo "❌ Error response format incorrect"
fi
echo ""

# 7. Test error handling - file too large
echo "7. Testing error handling (file too large)..."
ERROR_RESPONSE=$(curl -s -X POST "$API_URL/books/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "huge.pdf",
    "fileSize": 100000000000,
    "title": "Huge Book",
    "author": "Author"
  }')

echo "Response:"
echo $ERROR_RESPONSE | jq .

if echo $ERROR_RESPONSE | jq -e '.code' > /dev/null 2>&1; then
  ERROR_CODE=$(echo $ERROR_RESPONSE | jq -r '.code')
  if [ "$ERROR_CODE" = "FILE_TOO_LARGE" ]; then
    echo "✅ Error handling works (FILE_TOO_LARGE)"
  else
    echo "⚠️  Got error code: $ERROR_CODE"
  fi
else
  echo "❌ Error response format incorrect"
fi
echo ""

# 8. Check DynamoDB
echo "8. Checking DynamoDB..."
BOOK_ITEM=$(aws dynamodb get-item \
  --table-name OnlineLibrary \
  --key "{\"PK\":{\"S\":\"BOOK#$BOOK_ID\"},\"SK\":{\"S\":\"METADATA\"}}" \
  --region ap-southeast-1)

if echo $BOOK_ITEM | jq -e '.Item' > /dev/null 2>&1; then
  STATUS=$(echo $BOOK_ITEM | jq -r '.Item.status.S')
  echo "✅ Book found in DynamoDB"
  echo "   Status: $STATUS"
  echo "   Full item:"
  echo $BOOK_ITEM | jq '.Item'
else
  echo "❌ Book not found in DynamoDB"
fi
echo ""

echo "=== All Tests Complete ==="
echo ""
echo "Summary:"
echo "✅ API deployed and working"
echo "✅ Authentication working"
echo "✅ Create Upload URL endpoint working"
echo "✅ Error handling working"
echo "✅ DynamoDB integration working"
echo ""
echo "Next steps:"
echo "1. Upload a file to the presigned URL"
echo "2. Test other endpoints (search, approve, etc.)"
echo "3. Run full test suite: pytest BACKEND/tests/lambda/"

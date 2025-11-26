#!/bin/bash

# Test getReadUrl Lambda directly

set -e

REGION="ap-southeast-1"
BOOK_ID="test-book-$(date +%s)"
TABLE_NAME="OnlineLibrary"
BUCKET_NAME="onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t"

echo "=== Testing getReadUrl Lambda ==="
echo "Book ID: $BOOK_ID"
echo ""

# 1. Create approved book in DynamoDB
echo "1️⃣  Creating approved book in DynamoDB..."
aws dynamodb put-item \
  --table-name $TABLE_NAME \
  --item "{
    \"PK\": {\"S\": \"BOOK#$BOOK_ID\"},
    \"SK\": {\"S\": \"METADATA\"},
    \"bookId\": {\"S\": \"$BOOK_ID\"},
    \"title\": {\"S\": \"Test Book\"},
    \"author\": {\"S\": \"Test Author\"},
    \"status\": {\"S\": \"APPROVED\"},
    \"file_path\": {\"S\": \"public/books/$BOOK_ID/test.pdf\"}
  }" \
  --region $REGION

echo "✅ Book created"
echo ""

# 2. Create test PDF in S3
echo "2️⃣  Creating test PDF in S3..."
echo "%PDF-1.4" > /tmp/test.pdf
echo "Test content" >> /tmp/test.pdf
aws s3 cp /tmp/test.pdf s3://$BUCKET_NAME/public/books/$BOOK_ID/test.pdf --region $REGION
echo "✅ PDF uploaded"
echo ""

# 3. Invoke getReadUrl Lambda
echo "3️⃣  Invoking getReadUrl Lambda..."
LAMBDA_RESPONSE=$(aws lambda invoke \
  --function-name OnlineLibrary-dev-Api-GetReadUrlFn* \
  --payload "{\"pathParameters\": {\"bookId\": \"$BOOK_ID\"}}" \
  --region $REGION \
  /tmp/lambda_response.json 2>&1 | grep -v "^{" || true)

echo "Lambda Response:"
cat /tmp/lambda_response.json | jq .

# Extract URL
READ_URL=$(cat /tmp/lambda_response.json | jq -r '.body' | jq -r '.url' 2>/dev/null || echo "")

if [ -z "$READ_URL" ] || [ "$READ_URL" == "null" ]; then
  echo "❌ Failed to get read URL"
  exit 1
fi

echo ""
echo "✅ Read URL generated:"
echo "   $READ_URL"
echo ""

# 4. Verify URL format
echo "4️⃣  Verifying URL format..."
if [[ $READ_URL == *"Policy="* ]] && [[ $READ_URL == *"Signature="* ]] && [[ $READ_URL == *"Key-Pair-Id="* ]]; then
  echo "✅ URL has all required parameters"
else
  echo "❌ URL missing required parameters"
  exit 1
fi

echo ""
echo "🎉 getReadUrl Test Passed!"

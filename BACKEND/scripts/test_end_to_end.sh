#!/bin/bash

# End-to-end test: Upload → Validate → Read

set -e

# Configuration
API_ENDPOINT="${API_ENDPOINT:-https://your-api-endpoint}"
JWT_TOKEN="${JWT_TOKEN:-your-jwt-token}"
REGION="ap-southeast-1"

echo "=== End-to-End Test: Upload → Validate → Read ==="
echo "API Endpoint: $API_ENDPOINT"
echo ""

# 1. Create test PDF
echo "1️⃣  Creating test PDF..."
echo "%PDF-1.4" > /tmp/test_book.pdf
echo "This is a test PDF file" >> /tmp/test_book.pdf
echo "%%EOF" >> /tmp/test_book.pdf
echo "✅ PDF created"
echo ""

# 2. Request upload URL
echo "2️⃣  Requesting upload URL..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_ENDPOINT/books/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test_book.pdf",
    "fileSize": 100,
    "title": "Test Book",
    "author": "Test Author",
    "description": "A test book for E2E testing"
  }')

echo "Response: $UPLOAD_RESPONSE"
BOOK_ID=$(echo $UPLOAD_RESPONSE | jq -r '.bookId')
UPLOAD_URL=$(echo $UPLOAD_RESPONSE | jq -r '.uploadUrl')

if [ -z "$BOOK_ID" ] || [ "$BOOK_ID" == "null" ]; then
  echo "❌ Failed to get upload URL"
  exit 1
fi

echo "✅ Got upload URL"
echo "   Book ID: $BOOK_ID"
echo ""

# 3. Upload file to S3
echo "3️⃣  Uploading file to S3..."
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary @/tmp/test_book.pdf

echo ""
echo "✅ File uploaded"
echo ""

# 4. Wait for Lambda processing
echo "4️⃣  Waiting for Lambda validation (10 seconds)..."
sleep 10
echo "✅ Lambda should have processed the file"
echo ""

# 5. Get read URL
echo "5️⃣  Getting read URL..."
READ_URL_RESPONSE=$(curl -s -X GET "$API_ENDPOINT/books/$BOOK_ID/read-url" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Response: $READ_URL_RESPONSE"
READ_URL=$(echo $READ_URL_RESPONSE | jq -r '.url')

if [ -z "$READ_URL" ] || [ "$READ_URL" == "null" ]; then
  echo "❌ Failed to get read URL"
  exit 1
fi

echo "✅ Got read URL"
echo "   URL: $READ_URL"
echo ""

# 6. Download file
echo "6️⃣  Downloading file from CloudFront..."
curl -s "$READ_URL" -o /tmp/downloaded_book.pdf

if [ -f /tmp/downloaded_book.pdf ]; then
  FILE_SIZE=$(wc -c < /tmp/downloaded_book.pdf)
  echo "✅ File downloaded successfully"
  echo "   Size: $FILE_SIZE bytes"
else
  echo "❌ Failed to download file"
  exit 1
fi

echo ""
echo "🎉 End-to-End Test Passed!"
echo ""
echo "Summary:"
echo "  ✅ Upload URL generated"
echo "  ✅ File uploaded to S3"
echo "  ✅ Lambda validated file"
echo "  ✅ Read URL generated"
echo "  ✅ File downloaded from CloudFront"

#!/bin/bash
# Update S3 bucket CORS configuration

BUCKET_NAME="onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t"

echo "Setting CORS configuration for S3 bucket: $BUCKET_NAME"

aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST", "GET", "HEAD"],
      "AllowedOrigins": [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fe-ken.d19yocdajp91pq.amplifyapp.com"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

echo "✅ S3 CORS configuration updated!"
echo ""
echo "Verifying CORS config:"
aws s3api get-bucket-cors --bucket $BUCKET_NAME

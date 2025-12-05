#!/bin/bash

DISTRIBUTION_ID="ESEZSS4C9GYA9"
BUCKET="onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t"
ACCOUNT_ID="303846056417"

# Create policy
POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET/public/books/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DISTRIBUTION_ID"
        }
      }
    }
  ]
}
EOF
)

# Apply policy
aws s3api put-bucket-policy \
  --bucket $BUCKET \
  --policy "$POLICY" \
  --region ap-southeast-1

echo "✅ CloudFront policy added for distribution $DISTRIBUTION_ID"

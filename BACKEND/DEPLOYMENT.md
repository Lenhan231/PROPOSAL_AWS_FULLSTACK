# CDK Deployment Guide

## Prerequisites

1. **AWS Account** - Configured with credentials
2. **Python 3.12+** - For CDK and Lambda
3. **Node.js 18+** - For CDK CLI
4. **AWS CDK CLI** - `npm install -g aws-cdk`

## Setup

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Lambda dependencies (for local testing)
pip install -r lambda/requirements.txt  # If exists
```

### 2. Bootstrap CDK (First time only)

```bash
# Bootstrap your AWS account for CDK
cdk bootstrap aws://ACCOUNT_ID/REGION

# Example:
cdk bootstrap aws://123456789012/ap-southeast-1
```

## Deployment

### 1. Synthesize CloudFormation Template

```bash
# Generate CloudFormation template
cdk synth

# Or with specific environment
cdk synth -c env=dev
```

### 2. Deploy Stacks

```bash
# Deploy all stacks
cdk deploy --all

# Deploy specific stack
cdk deploy OnlineLibrary-dev-Cognito

# Deploy with approval
cdk deploy --all --require-approval=any-change

# Deploy specific environment
cdk deploy --all -c env=prod
```

### 3. Deployment Order

CDK automatically handles dependencies, but stacks deploy in this order:

1. **CognitoStack** - User authentication
2. **DatabaseStack** - DynamoDB table
3. **StorageStack** - S3 buckets
4. **CdnStack** - CloudFront distribution
5. **ApiStack** - API Gateway + Lambda functions

## Testing API

### 1. Get API Endpoint

```bash
# After deployment, get API URL from outputs
aws cloudformation describe-stacks \
  --stack-name OnlineLibrary-dev-Api \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text
```

### 2. Get Cognito Credentials

```bash
# Get User Pool ID
aws cloudformation describe-stacks \
  --stack-name OnlineLibrary-dev-Cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text

# Get Client ID
aws cloudformation describe-stacks \
  --stack-name OnlineLibrary-dev-Cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text
```

### 3. Create Test User

```bash
# Create user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username testuser \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <USER_POOL_ID> \
  --username testuser \
  --password Password123! \
  --permanent
```

### 4. Get JWT Token

```bash
# Authenticate and get tokens
aws cognito-idp admin-initiate-auth \
  --user-pool-id <USER_POOL_ID> \
  --client-id <CLIENT_ID> \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser,PASSWORD=Password123!
```

### 5. Test Create Upload URL Endpoint

```bash
# Set variables
API_URL="https://xxxxx.execute-api.ap-southeast-1.amazonaws.com"
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Call API
curl -X POST "$API_URL/books/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "book.pdf",
    "fileSize": 1024000,
    "title": "My Book",
    "author": "John Doe",
    "description": "A great book"
  }'
```

## Monitoring

### 1. View Lambda Logs

```bash
# Get logs for createUploadUrl Lambda
aws logs tail /aws/lambda/OnlineLibrary-dev-Api-CreateUploadUrlFn \
  --follow

# Get logs for getReadUrl Lambda
aws logs tail /aws/lambda/OnlineLibrary-dev-Api-GetReadUrlFn \
  --follow
```

### 2. Check DynamoDB

```bash
# Scan books table
aws dynamodb scan \
  --table-name OnlineLibrary \
  --region ap-southeast-1

# Get specific book
aws dynamodb get-item \
  --table-name OnlineLibrary \
  --key '{"PK":{"S":"BOOK#book-id"},"SK":{"S":"METADATA"}}' \
  --region ap-southeast-1
```

### 3. Check S3

```bash
# List uploads
aws s3 ls s3://onlinelibrary-uploads-bucket/uploads/

# List public books
aws s3 ls s3://onlinelibrary-uploads-bucket/public/books/
```

## Cleanup

### 1. Destroy Stacks

```bash
# Destroy all stacks
cdk destroy --all

# Destroy specific stack
cdk destroy OnlineLibrary-dev-Api

# Destroy without confirmation
cdk destroy --all --force
```

### 2. Manual Cleanup

```bash
# Delete CloudFormation stacks
aws cloudformation delete-stack --stack-name OnlineLibrary-dev-Api
aws cloudformation delete-stack --stack-name OnlineLibrary-dev-Cdn
aws cloudformation delete-stack --stack-name OnlineLibrary-dev-Storage
aws cloudformation delete-stack --stack-name OnlineLibrary-dev-Database
aws cloudformation delete-stack --stack-name OnlineLibrary-dev-Cognito

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name OnlineLibrary-dev-Api
```

## Troubleshooting

### Issue: "User is not authorized to perform: iam:CreateRole"

**Solution:** Ensure your AWS credentials have sufficient IAM permissions.

### Issue: "Lambda code size exceeds maximum"

**Solution:** Check that Lambda code is properly bundled. Shared utilities should be included.

### Issue: "DynamoDB table already exists"

**Solution:** Either use different stack name or destroy existing stack first.

### Issue: "S3 bucket name already taken"

**Solution:** S3 bucket names are globally unique. Use different name in StorageStack.

## Environment Variables

### Development

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=ap-southeast-1
```

### Production

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=ap-southeast-1
cdk deploy --all -c env=prod
```

## Next Steps

1. **Test all Lambda functions** - Use provided test suite
2. **Implement remaining Lambdas** - searchBooks, approveBook, etc.
3. **Setup CI/CD** - GitHub Actions or CodePipeline
4. **Deploy Frontend** - Amplify Hosting
5. **Monitor Production** - CloudWatch dashboards and alarms

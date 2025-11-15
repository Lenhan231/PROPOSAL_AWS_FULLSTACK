# Design Document

## Overview

Tài liệu này mô tả thiết kế chi tiết cho lộ trình học và xây dựng backend của hệ thống Thư Viện Online. Lộ trình được chia thành 6 tuần với các module học tập và thực hành tăng dần độ phức tạp.

### Learning Path Structure

Lộ trình học được thiết kế theo mô hình "Learn → Practice → Build":
1. **Learn**: Học lý thuyết và khái niệm
2. **Practice**: Thực hành với ví dụ đơn giản
3. **Build**: Xây dựng tính năng thực tế cho dự án

### Technology Stack

- **Language**: Python 3.11 (cho Lambda functions)
- **IaC**: AWS CDK (TypeScript hoặc Python)
- **AWS Services**: Lambda, API Gateway (HTTP API), DynamoDB, S3, Cognito, CloudFront, IAM, CloudWatch
- **Tools**: AWS CLI, Git, Postman/Thunder Client

## Architecture

### High-Level Architecture

```
User/Admin
    ↓
[CloudFront] ← Signed URL for content delivery
    ↓
[API Gateway HTTP API] ← JWT Authentication
    ↓
[Lambda Functions] ← Business Logic
    ↓ ↓ ↓
[Cognito] [DynamoDB] [S3]
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              API Gateway (HTTP API)                      │
│  - JWT Authorizer (Cognito)                             │
│  - Rate Limiting & Throttling                           │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
   [Auth]      [Upload]     [Read]
   Lambda      Lambda       Lambda
        │          │            │
        ↓          ↓            ↓
   [Cognito]  [S3 Bucket]  [CloudFront]
                   │
                   ↓
              [DynamoDB]
```

## Components and Interfaces

### 1. Authentication Service (Cognito + Lambda)

**Purpose**: Quản lý đăng ký, đăng nhập, và phân quyền người dùng

**Components**:
- **Cognito User Pool**: Lưu trữ thông tin user
- **Cognito User Groups**: Phân quyền Admin/User
- **Lambda Authorizer**: Xác thực JWT token (optional, có thể dùng built-in JWT authorizer)

**Interfaces**:
```python
# POST /auth/signup
Request: {
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
Response: {
  "userId": "uuid",
  "message": "Please check your email to verify"
}

# POST /auth/login
Request: {
  "email": "user@example.com",
  "password": "SecurePass123!"
}
Response: {
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "expiresIn": 3600,
  "userGroups": ["Users"] or ["Admins"]
}

# POST /auth/refresh
Request: {
  "refreshToken": "refresh_token"
}
Response: {
  "accessToken": "new_jwt_token",
  "expiresIn": 3600
}
```

### 2. Upload Service (Lambda + S3)

**Purpose**: Xử lý upload file PDF/ePub với Presigned URL

**Components**:
- **createUploadUrl Lambda**: Tạo Presigned PUT URL
- **validateFile Lambda**: Validate MIME type khi file được upload (S3 Event trigger)
- **S3 Bucket**: Lưu trữ file trong thư mục `uploads/`

**Interfaces**:
```python
# POST /books/upload-url
Request: {
  "fileName": "book.pdf",
  "fileSize": 5242880,  # bytes
  "title": "AWS Serverless Guide",
  "author": "John Doe",
  "description": "A comprehensive guide"
}
Response: {
  "uploadUrl": "presigned_put_url",
  "bookId": "uuid",
  "expiresIn": 900  # 15 minutes
}

# S3 Event → validateFile Lambda (internal)
# Validates MIME type and updates DynamoDB status
```

**Flow**:
1. User gọi API `/books/upload-url` với metadata
2. Lambda tạo Presigned PUT URL (TTL 15 phút)
3. Lambda ghi metadata vào DynamoDB (status: PENDING)
4. User upload file trực tiếp lên S3 qua Presigned URL
5. S3 Event trigger Lambda `validateFile`
6. Lambda đọc magic bytes để validate MIME type
7. Nếu hợp lệ: giữ nguyên status PENDING
8. Nếu không hợp lệ: xóa file và update status REJECTED_INVALID_TYPE

### 3. Admin Approval Service (Lambda + S3)

**Purpose**: Admin duyệt hoặc từ chối file đã upload

**Components**:
- **listPendingBooks Lambda**: Lấy danh sách file pending
- **approveBook Lambda**: Duyệt file (copy từ uploads/ sang public/books/)
- **rejectBook Lambda**: Từ chối file (xóa file và update status)

**Interfaces**:
```python
# GET /admin/books/pending
Response: {
  "books": [
    {
      "bookId": "uuid",
      "title": "Book Title",
      "author": "Author Name",
      "uploader": "user@example.com",
      "uploadedAt": "2025-01-15T10:30:00Z",
      "fileSize": 5242880,
      "status": "PENDING"
    }
  ]
}

# POST /admin/books/{bookId}/approve
Response: {
  "bookId": "uuid",
  "status": "APPROVED",
  "message": "Book approved successfully"
}

# POST /admin/books/{bookId}/reject
Request: {
  "reason": "Copyright violation"
}
Response: {
  "bookId": "uuid",
  "status": "REJECTED",
  "message": "Book rejected"
}
```

**Authorization Check**:
```python
def check_admin(event):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    groups = claims.get('cognito:groups', [])
    if 'Admins' not in groups:
        return {
            'statusCode': 403,
            'body': json.dumps({'error': 'Forbidden: Admin access required'})
        }
```

### 4. Read Service (Lambda + CloudFront)

**Purpose**: Phân phối nội dung an toàn qua CloudFront Signed URL

**Components**:
- **getReadUrl Lambda**: Tạo CloudFront Signed URL
- **CloudFront Distribution**: CDN để phân phối file
- **S3 Bucket**: Lưu file trong thư mục `public/books/`
- **OAC (Origin Access Control)**: Chặn truy cập trực tiếp S3

**Interfaces**:
```python
# GET /books/{bookId}/read-url
Response: {
  "readUrl": "cloudfront_signed_url",
  "expiresIn": 3600  # 1 hour
}
```

**CloudFront Configuration**:
- Origin: S3 bucket với OAC
- Behavior: Require signed URLs
- Cache: Cache metadata API responses (3-5 minutes), không cache Signed URL

### 5. Search Service (Lambda + DynamoDB GSI)

**Purpose**: Tìm kiếm sách theo title hoặc author

**Components**:
- **searchBooks Lambda**: Query DynamoDB GSI
- **DynamoDB GSI**: GSI1 (title), GSI2 (author)

**Interfaces**:
```python
# GET /books/search?title=aws&author=john
Response: {
  "books": [
    {
      "bookId": "uuid",
      "title": "AWS Serverless Guide",
      "author": "John Doe",
      "description": "...",
      "uploadedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

## Data Models

### DynamoDB Table Design (Single Table)

**Table Name**: `OnlineLibrary`

**Primary Key**:
- PK (Partition Key): String
- SK (Sort Key): String

**GSI1** (for title search):
- GSI1PK: `TITLE#{normalizedTitle}`
- GSI1SK: `BOOK#{bookId}`

**GSI2** (for author search):
- GSI2PK: `AUTHOR#{normalizedAuthor}`
- GSI2SK: `BOOK#{bookId}`

**Item Types**:

1. **Book Metadata**:
```python
{
  "PK": "BOOK#{bookId}",
  "SK": "METADATA",
  "bookId": "uuid",
  "title": "AWS Serverless Guide",
  "author": "John Doe",
  "description": "...",
  "uploaderId": "user_uuid",
  "uploaderEmail": "user@example.com",
  "status": "PENDING|APPROVED|REJECTED|REJECTED_INVALID_TYPE",
  "fileSize": 5242880,
  "s3Key": "uploads/uuid/book.pdf",
  "uploadedAt": "2025-01-15T10:30:00Z",
  "approvedAt": "2025-01-15T11:00:00Z",  # optional
  "approvedBy": "admin_uuid",  # optional
  "GSI1PK": "TITLE#aws-serverless-guide",
  "GSI1SK": "BOOK#uuid",
  "GSI2PK": "AUTHOR#john-doe",
  "GSI2SK": "BOOK#uuid"
}
```

2. **Audit Log**:
```python
{
  "PK": "BOOK#{bookId}",
  "SK": "AUDIT#{timestamp}",
  "action": "APPROVED|REJECTED|UPLOADED",
  "actorId": "user_uuid",
  "actorEmail": "admin@example.com",
  "timestamp": "2025-01-15T11:00:00Z",
  "details": {
    "reason": "..."  # for rejection
  }
}
```

### S3 Bucket Structure

```
online-library-bucket/
├── uploads/              # Pending files
│   └── {bookId}/
│       └── {filename}
├── public/
│   └── books/           # Approved files
│       └── {bookId}/
│           └── {filename}
└── quarantine/          # Takedown files (optional)
    └── books/
        └── {bookId}/
            └── {filename}
```

## Error Handling

### Error Response Format

```python
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "requestId": "uuid",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_REQUEST | Request body không hợp lệ |
| 401 | UNAUTHORIZED | Token không hợp lệ hoặc hết hạn |
| 403 | FORBIDDEN | Không có quyền truy cập |
| 404 | NOT_FOUND | Resource không tồn tại |
| 413 | FILE_TOO_LARGE | File vượt quá 50MB |
| 415 | UNSUPPORTED_MEDIA_TYPE | MIME type không hợp lệ |
| 429 | TOO_MANY_REQUESTS | Vượt quá rate limit |
| 500 | INTERNAL_ERROR | Lỗi server |

### Lambda Error Handling Pattern

```python
import json
import traceback
from datetime import datetime

def lambda_handler(event, context):
    try:
        # Business logic here
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success'})
        }
    except ValueError as e:
        return error_response(400, 'INVALID_REQUEST', str(e), context)
    except PermissionError as e:
        return error_response(403, 'FORBIDDEN', str(e), context)
    except Exception as e:
        print(f"Unexpected error: {traceback.format_exc()}")
        return error_response(500, 'INTERNAL_ERROR', 'An unexpected error occurred', context)

def error_response(status_code, error_code, message, context):
    return {
        'statusCode': status_code,
        'body': json.dumps({
            'error': message,
            'code': error_code,
            'requestId': context.request_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        })
    }
```

## Testing Strategy

### Unit Testing

**Tools**: pytest, moto (AWS mocking)

**Test Coverage**:
- Lambda function logic
- DynamoDB operations
- S3 operations
- JWT validation
- MIME type validation

**Example**:
```python
import pytest
from moto import mock_dynamodb, mock_s3
from lambda_functions.create_upload_url import handler

@mock_dynamodb
@mock_s3
def test_create_upload_url_success():
    # Setup
    event = {
        'body': json.dumps({
            'fileName': 'test.pdf',
            'fileSize': 1024,
            'title': 'Test Book',
            'author': 'Test Author'
        }),
        'requestContext': {
            'authorizer': {
                'jwt': {
                    'claims': {
                        'sub': 'user-123',
                        'email': 'test@example.com'
                    }
                }
            }
        }
    }
    
    # Execute
    response = handler(event, {})
    
    # Assert
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'uploadUrl' in body
    assert 'bookId' in body
```

### Integration Testing

**Tools**: AWS SAM Local, LocalStack (optional)

**Test Scenarios**:
- End-to-end upload flow
- Admin approval flow
- Read flow with Signed URL
- Search functionality

### Load Testing

**Tools**: Artillery, Locust

**Test Scenarios**:
- Concurrent uploads
- API Gateway rate limiting
- DynamoDB throughput
- CloudFront caching

## Security Considerations

### 1. Authentication & Authorization

- JWT token validation trên API Gateway
- Admin check trong Lambda functions
- Token expiration: 1 hour (access token), 30 days (refresh token)

### 2. S3 Security

- Block public access
- OAC (Origin Access Control) cho CloudFront
- Presigned URL với TTL ngắn (15 phút cho PUT, 1 giờ cho GET)
- Bucket policy chỉ cho phép CloudFront và Lambda

### 3. IAM Least Privilege

Mỗi Lambda có role riêng với quyền tối thiểu:

```python
# createUploadUrl Lambda
- s3:PutObject (chỉ uploads/*)
- dynamodb:PutItem

# approveBook Lambda
- s3:GetObject (uploads/*)
- s3:PutObject (public/books/*)
- s3:DeleteObject (uploads/*)
- dynamodb:UpdateItem

# getReadUrl Lambda
- dynamodb:GetItem
- cloudfront:CreateSignedUrl (via SDK)
```

### 4. Input Validation

- File size limit: 50MB
- File type: PDF, ePub only (validate bằng magic bytes)
- Sanitize user input (title, author, description)
- Rate limiting trên API Gateway

### 5. CORS Configuration

```python
cors_config = {
    'allowOrigins': ['https://yourdomain.com'],
    'allowMethods': ['GET', 'POST', 'PUT', 'DELETE'],
    'allowHeaders': ['Content-Type', 'Authorization'],
    'maxAge': 3600
}
```

## Monitoring and Logging

### CloudWatch Logs

**Log Groups**:
- `/aws/lambda/createUploadUrl`
- `/aws/lambda/approveBook`
- `/aws/lambda/getReadUrl`
- `/aws/lambda/searchBooks`
- `/aws/lambda/validateFile`

**Log Retention**: 14 days

**Log Format**:
```python
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

logger.info(json.dumps({
    'requestId': context.request_id,
    'userId': user_id,
    'action': 'CREATE_UPLOAD_URL',
    'bookId': book_id,
    'timestamp': datetime.utcnow().isoformat()
}))
```

### CloudWatch Alarms

1. **Lambda Error Rate**:
   - Metric: Errors / Invocations
   - Threshold: > 5%
   - Action: SNS notification

2. **API Gateway 4xx/5xx**:
   - Metric: 4XXError, 5XXError
   - Threshold: > 10 errors in 5 minutes
   - Action: SNS notification

3. **DynamoDB Throttling**:
   - Metric: UserErrors
   - Threshold: > 0
   - Action: SNS notification

### AWS Budget Alerts

- Alert when cost > $10/month
- Alert when cost > $20/month (critical)

## Deployment Strategy

### Environment Setup

**Environments**:
- **dev**: Development environment
- **staging**: Pre-production testing
- **prod**: Production environment

**CDK Context**:
```json
{
  "dev": {
    "account": "123456789012",
    "region": "ap-southeast-1",
    "domainName": "dev.library.example.com"
  },
  "prod": {
    "account": "123456789012",
    "region": "ap-southeast-1",
    "domainName": "library.example.com"
  }
}
```

### CDK Stack Structure

```
cdk/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   ├── cognito-stack.ts       # Cognito User Pool
│   ├── database-stack.ts      # DynamoDB table
│   ├── storage-stack.ts       # S3 buckets
│   ├── api-stack.ts           # API Gateway + Lambda
│   ├── cdn-stack.ts           # CloudFront distribution
│   └── monitoring-stack.ts    # CloudWatch alarms
└── lambda/
    ├── create-upload-url/
    ├── approve-book/
    ├── get-read-url/
    ├── search-books/
    └── validate-file/
```

### Deployment Process

1. **Build**:
   ```bash
   npm run build
   cdk synth
   ```

2. **Test**:
   ```bash
   pytest tests/
   ```

3. **Deploy**:
   ```bash
   cdk deploy --all --context env=dev
   ```

4. **Rollback** (if needed):
   ```bash
   cdk deploy --all --context env=dev --rollback
   ```

### CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Deploy to AWS
        run: |
          npm run cdk deploy -- --all --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Learning Resources

### Week 1-2: Fundamentals

**Topics**:
- HTTP/REST API basics
- AWS account setup
- IAM basics
- Lambda fundamentals
- API Gateway basics

**Resources**:
- AWS Lambda Developer Guide
- AWS API Gateway Documentation
- "AWS Serverless Application Model" tutorial

**Practice**:
- Tạo Lambda "Hello World"
- Tạo API Gateway endpoint
- Test với Postman

### Week 3: Authentication

**Topics**:
- JWT tokens
- Cognito User Pools
- OAuth 2.0 / OpenID Connect

**Resources**:
- AWS Cognito Documentation
- JWT.io
- "Understanding OAuth 2.0" guide

**Practice**:
- Tạo Cognito User Pool
- Implement signup/login
- Test JWT validation

### Week 4: Storage & Upload

**Topics**:
- S3 basics
- Presigned URLs
- S3 Event Notifications
- File validation

**Resources**:
- AWS S3 Documentation
- "Working with Presigned URLs" guide

**Practice**:
- Upload file với Presigned URL
- Validate MIME type
- S3 Event trigger Lambda

### Week 5: Database & Search

**Topics**:
- DynamoDB basics
- Single-table design
- GSI (Global Secondary Index)
- Query vs Scan

**Resources**:
- AWS DynamoDB Documentation
- "The DynamoDB Book" by Alex DeBrie
- "Single Table Design" patterns

**Practice**:
- Design DynamoDB schema
- Implement search với GSI
- Query optimization

### Week 6: CDN & Monitoring

**Topics**:
- CloudFront basics
- Signed URLs
- CloudWatch Logs & Alarms
- AWS Budget

**Resources**:
- AWS CloudFront Documentation
- CloudWatch Documentation

**Practice**:
- Setup CloudFront distribution
- Create Signed URLs
- Setup CloudWatch alarms

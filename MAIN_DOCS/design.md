# Design Document - Thư Viện Online (Full-Stack)

## Overview

Tài liệu này mô tả thiết kế chi tiết full-stack cho hệ thống Thư Viện Online - một nền tảng serverless trên AWS để lưu trữ và phân phối nội dung PDF/ePub cho nhóm nhỏ (~100 người dùng).

### Design Goals

1. **Serverless-first**: Không quản lý servers, auto-scaling, pay-per-use
2. **Cost-effective**: Chi phí ≈ $9.80/tháng cho MVP (100 users)
3. **Secure**: JWT authentication, Signed URLs, OAC, least privilege IAM
4. **Scalable**: Có thể scale lên 5,000-50,000 users mà không thay đổi kiến trúc
5. **Simple**: Sử dụng managed services, ít operational overhead

### Technology Stack

**Backend** (Spec này):
- **IaC**: AWS CDK (Python)
- **Auth**: Amazon Cognito User Pools
- **API**: API Gateway HTTP API (không phải REST API)
- **Compute**: AWS Lambda (Python 3.11)
- **Database**: DynamoDB (On-Demand)
- **Storage**: Amazon S3
- **CDN**: Amazon CloudFront
- **Monitoring**: CloudWatch Logs, Alarms, AWS Budgets

**Frontend** (Spec riêng):
- **Hosting**: AWS Amplify
- **Framework**: React/Next.js
- **DNS**: Route 53

**Frontend**:
- **Framework**: Next.js 14 (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context / Zustand
- **Auth**: AWS Amplify Auth (Cognito SDK)
- **HTTP Client**: Axios / Fetch API
- **PDF Viewer**: react-pdf / PDF.js
- **ePub Viewer**: epub.js
- **Hosting**: AWS Amplify Hosting
- **CI/CD**: Amplify CI/CD (GitHub integration)

## Architecture

### High-Level Architecture

```
User/Admin
    ↓
[Route 53] → DNS resolution
    ↓
[CloudFront] → CDN for content delivery (Signed URLs)
    ↓
[API Gateway HTTP API] → Entry point, JWT validation
    ↓
[Lambda Functions] → Business logic
    ↓ ↓ ↓
[Cognito] [DynamoDB] [S3]
    ↓
[CloudWatch] → Monitoring & Logging
```

### Request Flow Diagram

```
1. Authentication Flow:
   User → Cognito → JWT tokens → Store in client

2. Upload Flow:
   User → API Gateway → createUploadUrl Lambda → Presigned URL
   User → S3 (direct upload) → S3 Event → validateMimeType Lambda

3. Approval Flow:
   Admin → API Gateway → approveBook Lambda → Copy S3 + Update DDB

4. Read Flow:
   User → API Gateway → getReadUrl Lambda → CloudFront Signed URL
   User → CloudFront → S3 (via OAC)
****
5. Search Flow:
   User → API Gateway → searchBooks Lambda → DynamoDB GSI Query
```

## Components and Interfaces

### 1. Cognito User Pool

**Purpose**: Quản lý authentication và user management

**Configuration**:

```typescript
// CDK Configuration
const userPool = new cognito.UserPool(this, 'UserPool', {
  selfSignUpEnabled: true,
  signInAliases: { email: true },
  autoVerify: { email: true },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// User Groups
const adminsGroup = new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'Admins',
  description: 'Admin users with approval permissions',
});

const usersGroup = new cognito.CfnUserPoolGroup(this, 'UsersGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'Users',
  description: 'Regular users',
});
```

**JWT Token Structure**:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "cognito:groups": ["Users"],
  "cognito:username": "user@example.com",
  "exp": 1735689600,
  "iat": 1735686000
}
```

### 2. API Gateway HTTP API

**Purpose**: Entry point cho tất cả API requests, JWT validation

**Endpoints**:

| Method | Path                          | Lambda           | Auth     | Description               |
| ------ | ----------------------------- | ---------------- | -------- | ------------------------- |
| POST   | /books/upload-url             | createUploadUrl  | Required | Tạo Presigned PUT URL     |
| GET    | /books/{bookId}/read-url      | getReadUrl       | Required | Tạo CloudFront Signed URL |
| GET    | /books/search                 | searchBooks      | Required | Tìm kiếm sách             |
| GET    | /books/my-uploads             | getMyUploads     | Required | Xem uploads của user      |
| GET    | /admin/books/pending          | listPendingBooks | Admin    | Lấy danh sách pending     |
| POST   | /admin/books/{bookId}/approve | approveBook      | Admin    | Duyệt sách                |
| POST   | /admin/books/{bookId}/reject  | rejectBook       | Admin    | Từ chối sách              |

**CDK Configuration**:
```typescript
const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
  apiName: 'OnlineLibraryApi',
  corsPreflight: {
    allowOrigins: ['https://yourdomain.com'],
    allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: cdk.Duration.hours(1),
  },
});

// JWT Authorizer
const authorizer = new apigatewayv2.HttpJwtAuthorizer('JwtAuthorizer', {
  jwtAudience: [userPoolClient.userPoolClientId],
  jwtIssuer: `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}`,
});

// Add routes
httpApi.addRoutes({
  path: '/books/upload-url',
  methods: [apigatewayv2.HttpMethod.POST],
  integration: new integrations.HttpLambdaIntegration('CreateUploadUrl', createUploadUrlLambda),
  authorizer,
});
```

**Throttling**:
- Burst: 1000 requests/second
- Steady: 500 requests/second

### 3. Lambda Functions

**Tổng cộng: 8 Lambda functions**

1. `createUploadUrl` - Tạo Presigned PUT URL
2. `validateMimeType` - Validate MIME type (S3 trigger)
3. `listPendingBooks` - Admin xem danh sách pending
4. `approveBook` - Admin duyệt sách
5. `rejectBook` - Admin từ chối sách (XÓA file)
6. `getMyUploads` - User xem uploads của mình
7. `getReadUrl` - Tạo CloudFront Signed URL
8. `searchBooks` - Tìm kiếm sách

#### 3.1 createUploadUrl Lambda

**Purpose**: Tạo Presigned PUT URL cho user upload file

**Input**:
```json
{
  "fileName": "book.pdf",
  "fileSize": 5242880,
  "title": "AWS Serverless Guide",
  "author": "John Doe",
  "description": "A comprehensive guide to AWS Serverless"
}
```

**Output**:
```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/uploads/uuid/book.pdf?X-Amz-...",
  "bookId": "uuid",
  "expiresIn": 900
}
```

**Logic**:
```python
import boto3
import uuid
import json
from datetime import datetime

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Parse request
    body = json.loads(event['body'])
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    user_email = event['requestContext']['authorizer']['jwt']['claims']['email']
    
    # Validate
    if body['fileSize'] > 50 * 1024 * 1024:  # 50MB
        return error_response(400, 'File size exceeds 50MB')
    
    if not body['fileName'].endswith(('.pdf', '.epub')):
        return error_response(400, 'Only PDF and ePub files are allowed')
    
    # Generate bookId
    book_id = str(uuid.uuid4())
    s3_key = f"uploads/{book_id}/{body['fileName']}"
    
    # Create Presigned URL
    upload_url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': 'online-library-bucket',
            'Key': s3_key,
            'ContentType': 'application/pdf' if body['fileName'].endswith('.pdf') else 'application/epub+zip'
        },
        ExpiresIn=900  # 15 minutes
    )
    
    # Save metadata to DynamoDB
    table.put_item(Item={
        'PK': f'BOOK#{book_id}',
        'SK': 'METADATA',
        'bookId': book_id,
        'title': body['title'],
        'author': body['author'],
        'description': body.get('description', ''),
        'uploaderId': user_id,
        'uploaderEmail': user_email,
        'status': 'PENDING',
        'fileSize': body['fileSize'],
        's3Key': s3_key,
        'uploadedAt': datetime.utcnow().isoformat() + 'Z',
        'GSI1PK': f"TITLE#{normalize(body['title'])}",
        'GSI1SK': f"BOOK#{book_id}",
        'GSI2PK': f"AUTHOR#{normalize(body['author'])}",
        'GSI2SK': f"BOOK#{book_id}"
    })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'uploadUrl': upload_url,
            'bookId': book_id,
            'expiresIn': 900
        })
    }

def normalize(text):
    return text.lower().replace(' ', '-').replace('_', '-')
```

**IAM Permissions**:
- `s3:PutObject` on `uploads/*`
- `dynamodb:PutItem` on table

#### 3.2 validateMimeType Lambda

**Purpose**: Validate MIME type của file sau khi upload (S3 Event trigger)

**Trigger**: S3 Event Notification khi có object mới trong `uploads/`

**Logic**:
```python
import boto3
import magic  # python-magic library

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Parse S3 event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    
    # Extract bookId from key: uploads/{bookId}/{filename}
    book_id = key.split('/')[1]
    
    # Download first 4KB to check magic bytes
    response = s3.get_object(Bucket=bucket, Key=key, Range='bytes=0-4095')
    file_header = response['Body'].read()
    
    # Detect MIME type
    mime_type = magic.from_buffer(file_header, mime=True)
    
    # Validate
    valid_types = ['application/pdf', 'application/epub+zip']
    
    if mime_type not in valid_types:
        # Invalid MIME type - delete file and update status
        s3.delete_object(Bucket=bucket, Key=key)
        
        table.update_item(
            Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'REJECTED_INVALID_TYPE'}
        )
        
        print(f'Invalid MIME type {mime_type} for book {book_id}. File deleted.')
    else:
        print(f'Valid MIME type {mime_type} for book {book_id}.')
    
    return {'statusCode': 200}
```

**IAM Permissions**:
- `s3:GetObject` on `uploads/*`
- `s3:DeleteObject` on `uploads/*`
- `dynamodb:UpdateItem` on table

#### 3.3 listPendingBooks Lambda

**Purpose**: Admin xem danh sách sách pending

**Output**:
```json
{
  "books": [
    {
      "bookId": "uuid",
      "title": "Book Title",
      "author": "Author Name",
      "uploader": "user@example.com",
      "uploadedAt": "2025-01-15T10:30:00Z",
      "fileSize": 5242880
    }
  ],
  "count": 5
}
```

**Logic**:
```python
import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Check admin permission
    groups = event['requestContext']['authorizer']['jwt']['claims'].get('cognito:groups', [])
    if 'Admins' not in groups:
        return error_response(403, 'Forbidden: Admin access required')
    
    # Scan for PENDING books (or use GSI if designed)
    response = table.scan(
        FilterExpression='#status = :status AND SK = :sk',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={':status': 'PENDING', ':sk': 'METADATA'}
    )
    
    books = []
    for item in response['Items']:
        books.append({
            'bookId': item['bookId'],
            'title': item['title'],
            'author': item['author'],
            'uploader': item['uploaderEmail'],
            'uploadedAt': item['uploadedAt'],
            'fileSize': item['fileSize']
        })
    
    # Sort by uploadedAt descending
    books.sort(key=lambda x: x['uploadedAt'], reverse=True)
    
    return {
        'statusCode': 200,
        'body': json.dumps({'books': books, 'count': len(books)})
    }
```

**IAM Permissions**:
- `dynamodb:Scan` on table (hoặc `dynamodb:Query` nếu có GSI cho status)

#### 3.4 approveBook Lambda

**Purpose**: Admin duyệt sách (copy từ uploads/ sang public/books/)

**Input**:
```json
{
  "bookId": "uuid"
}
```

**Output**:
```json
{
  "bookId": "uuid",
  "status": "APPROVED",
  "message": "Book approved successfully"
}
```

**Logic**:
```python
import boto3
import json
from datetime import datetime

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Check admin permission
    groups = event['requestContext']['authorizer']['jwt']['claims'].get('cognito:groups', [])
    if 'Admins' not in groups:
        return error_response(403, 'Forbidden: Admin access required')
    
    # Parse request
    book_id = event['pathParameters']['bookId']
    admin_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    admin_email = event['requestContext']['authorizer']['jwt']['claims']['email']
    
    # Get book metadata
    response = table.get_item(Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'})
    if 'Item' not in response:
        return error_response(404, 'Book not found')
    
    book = response['Item']
    
    if book['status'] != 'PENDING':
        return error_response(400, f"Book status is {book['status']}, cannot approve")
    
    # Copy file from uploads/ to public/books/
    source_key = book['s3Key']
    dest_key = source_key.replace('uploads/', 'public/books/')
    
    s3.copy_object(
        Bucket='online-library-bucket',
        CopySource={'Bucket': 'online-library-bucket', 'Key': source_key},
        Key=dest_key
    )
    
    # Delete from uploads/ (cleanup)
    s3.delete_object(Bucket='online-library-bucket', Key=source_key)
    
    # Update DynamoDB
    now = datetime.utcnow().isoformat() + 'Z'
    table.update_item(
        Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'},
        UpdateExpression='SET #status = :status, s3Key = :s3Key, approvedAt = :approvedAt, approvedBy = :approvedBy',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'APPROVED',
            ':s3Key': dest_key,
            ':approvedAt': now,
            ':approvedBy': admin_id
        }
    )
    
    # Write audit log
    table.put_item(Item={
        'PK': f'BOOK#{book_id}',
        'SK': f'AUDIT#{now}',
        'action': 'APPROVED',
        'actorId': admin_id,
        'actorEmail': admin_email,
        'timestamp': now
    })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'bookId': book_id,
            'status': 'APPROVED',
            'message': 'Book approved successfully'
        })
    }
```

**IAM Permissions**:
- `s3:GetObject` on `uploads/*`
- `s3:PutObject` on `public/books/*`
- `s3:DeleteObject` on `uploads/*`
- `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:PutItem` on table

#### 3.5 rejectBook Lambda

**Purpose**: Admin từ chối sách (xóa file và update status)

**Input**:
```json
{
  "bookId": "uuid",
  "reason": "Copyright violation"
}
```

**Output**:
```json
{
  "bookId": "uuid",
  "status": "REJECTED",
  "message": "Book rejected successfully"
}
```

**Logic**:
```python
import boto3
import json
from datetime import datetime

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Check admin permission
    groups = event['requestContext']['authorizer']['jwt']['claims'].get('cognito:groups', [])
    if 'Admins' not in groups:
        return error_response(403, 'Forbidden: Admin access required')
    
    # Parse request
    book_id = event['pathParameters']['bookId']
    body = json.loads(event['body'])
    reason = body.get('reason', 'No reason provided')
    admin_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    admin_email = event['requestContext']['authorizer']['jwt']['claims']['email']
    
    # Get book metadata
    response = table.get_item(Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'})
    if 'Item' not in response:
        return error_response(404, 'Book not found')
    
    book = response['Item']
    
    if book['status'] != 'PENDING':
        return error_response(400, f"Book status is {book['status']}, cannot reject")
    
    # DELETE file from S3 (tối ưu chi phí)
    s3.delete_object(Bucket='online-library-bucket', Key=book['s3Key'])
    
    # Update DynamoDB (giữ metadata để user biết lý do reject)
    now = datetime.utcnow().isoformat() + 'Z'
    table.update_item(
        Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'},
        UpdateExpression='SET #status = :status, rejectedAt = :rejectedAt, rejectedBy = :rejectedBy, rejectedReason = :reason',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'REJECTED',
            ':rejectedAt': now,
            ':rejectedBy': admin_id,
            ':reason': reason
        }
    )
    
    # Write audit log
    table.put_item(Item={
        'PK': f'BOOK#{book_id}',
        'SK': f'AUDIT#{now}',
        'action': 'REJECTED',
        'actorId': admin_id,
        'actorEmail': admin_email,
        'timestamp': now,
        'reason': reason
    })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'bookId': book_id,
            'status': 'REJECTED',
            'message': 'Book rejected successfully'
        })
    }
```

**IAM Permissions**:
- `s3:DeleteObject` on `uploads/*`
- `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:PutItem` on table

#### 3.6 getMyUploads Lambda

**Purpose**: User xem danh sách sách đã upload

**Output**:
```json
{
  "books": [
    {
      "bookId": "uuid",
      "title": "My Book",
      "status": "APPROVED",
      "uploadedAt": "2025-01-15T10:30:00Z",
      "approvedAt": "2025-01-15T11:00:00Z"
    },
    {
      "bookId": "uuid2",
      "title": "Rejected Book",
      "status": "REJECTED",
      "uploadedAt": "2025-01-14T10:30:00Z",
      "rejectedReason": "Copyright violation"
    }
  ],
  "count": 2
}
```

**Logic**:
```python
import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Get user ID from JWT
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    
    # Query books by uploaderId (need GSI3 for this)
    response = table.scan(
        FilterExpression='uploaderId = :userId AND SK = :sk',
        ExpressionAttributeValues={':userId': user_id, ':sk': 'METADATA'}
    )
    
    books = []
    for item in response['Items']:
        book_data = {
            'bookId': item['bookId'],
            'title': item['title'],
            'author': item['author'],
            'status': item['status'],
            'uploadedAt': item['uploadedAt']
        }
        
        # Add status-specific fields
        if item['status'] == 'APPROVED':
            book_data['approvedAt'] = item.get('approvedAt')
        elif item['status'] == 'REJECTED':
            book_data['rejectedReason'] = item.get('rejectedReason', 'No reason provided')
        
        books.append(book_data)
    
    # Sort by uploadedAt descending
    books.sort(key=lambda x: x['uploadedAt'], reverse=True)
    
    return {
        'statusCode': 200,
        'body': json.dumps({'books': books, 'count': len(books)})
    }
```

**IAM Permissions**:
- `dynamodb:Scan` on table (hoặc `dynamodb:Query` nếu có GSI3 cho uploaderId)

#### 3.7 getReadUrl Lambda

**Purpose**: Tạo CloudFront Signed URL cho user đọc sách

**Input**:
```json
{
  "bookId": "uuid"
}
```

**Output**:
```json
{
  "readUrl": "https://d123.cloudfront.net/public/books/uuid/book.pdf?Expires=...",
  "expiresIn": 3600
}
```

**Logic**:
```python
import boto3
import json
from datetime import datetime, timedelta
from botocore.signers import CloudFrontSigner
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Parse request
    book_id = event['pathParameters']['bookId']
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    
    # Get book metadata
    response = table.get_item(Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'})
    if 'Item' not in response:
        return error_response(404, 'Book not found')
    
    book = response['Item']
    
    if book['status'] != 'APPROVED':
        return error_response(403, 'Book not approved yet')
    
    # Create CloudFront Signed URL
    cloudfront_domain = 'd123.cloudfront.net'
    s3_key = book['s3Key']
    url = f'https://{cloudfront_domain}/{s3_key}'
    
    # Sign URL (TTL 1 hour)
    expires = datetime.utcnow() + timedelta(hours=1)
    signed_url = create_signed_url(url, expires)
    
    # Log access
    print(json.dumps({
        'action': 'READ_ACCESS',
        'userId': user_id,
        'bookId': book_id,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }))
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'readUrl': signed_url,
            'expiresIn': 3600
        })
    }

def create_signed_url(url, expires):
    # Load CloudFront private key from environment or Secrets Manager
    private_key_pem = get_private_key()
    key_id = 'CLOUDFRONT_KEY_ID'
    
    def rsa_signer(message):
        private_key = load_pem_private_key(private_key_pem.encode(), password=None, backend=default_backend())
        return private_key.sign(message, padding.PKCS1v15(), hashes.SHA1())
    
    cloudfront_signer = CloudFrontSigner(key_id, rsa_signer)
    signed_url = cloudfront_signer.generate_presigned_url(url, date_less_than=expires)
    
    return signed_url
```

**IAM Permissions**:
- `dynamodb:GetItem` on table
- `cloudfront:CreateSignedUrl` (implicit via SDK)

#### 3.8 searchBooks Lambda

**Purpose**: Tìm kiếm sách theo title hoặc author

**Input**:
```
GET /books/search?title=aws&author=john
```

**Output**:
```json
{
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

**Logic**:
```python
import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('OnlineLibrary')

def lambda_handler(event, context):
    # Parse query parameters
    params = event.get('queryStringParameters', {})
    title = params.get('title', '').strip()
    author = params.get('author', '').strip()
    
    if not title and not author:
        return error_response(400, 'At least one of title or author is required')
    
    book_ids = set()
    
    # Search by title
    if title:
        response = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={':pk': f'TITLE#{normalize(title)}'}
        )
        title_book_ids = {item['bookId'] for item in response['Items']}
        book_ids = title_book_ids if not book_ids else book_ids
    
    # Search by author
    if author:
        response = table.query(
            IndexName='GSI2',
            KeyConditionExpression='GSI2PK = :pk',
            ExpressionAttributeValues={':pk': f'AUTHOR#{normalize(author)}'}
        )
        author_book_ids = {item['bookId'] for item in response['Items']}
        
        if title:
            # Intersection: books matching both title AND author
            book_ids = book_ids.intersection(author_book_ids)
        else:
            book_ids = author_book_ids
    
    # Get full metadata for matching books
    books = []
    for book_id in book_ids:
        response = table.get_item(Key={'PK': f'BOOK#{book_id}', 'SK': 'METADATA'})
        if 'Item' in response and response['Item']['status'] == 'APPROVED':
            book = response['Item']
            books.append({
                'bookId': book['bookId'],
                'title': book['title'],
                'author': book['author'],
                'description': book.get('description', ''),
                'uploadedAt': book['uploadedAt']
            })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'books': books,
            'count': len(books)
        })
    }

def normalize(text):
    return text.lower().replace(' ', '-').replace('_', '-')
```

**IAM Permissions**:
- `dynamodb:Query` on GSI1, GSI2
- `dynamodb:GetItem` on table

## Data Models

### DynamoDB Table Design

**Table Name**: `OnlineLibrary`

**Primary Key**:
- PK (Partition Key): String
- SK (Sort Key): String

**GSI1** (Title Search):
- GSI1PK: `TITLE#{normalizedTitle}`
- GSI1SK: `BOOK#{bookId}`

**GSI2** (Author Search):
- GSI2PK: `AUTHOR#{normalizedAuthor}`
- GSI2SK: `BOOK#{bookId}`

**Item Types**:

1. **Book Metadata**:
```json
{
  "PK": "BOOK#uuid",
  "SK": "METADATA",
  "bookId": "uuid",
  "title": "AWS Serverless Guide",
  "author": "John Doe",
  "description": "A comprehensive guide",
  "uploaderId": "user-uuid",
  "uploaderEmail": "user@example.com",
  "status": "PENDING|APPROVED|REJECTED|REJECTED_INVALID_TYPE",
  "fileSize": 5242880,
  "s3Key": "uploads/uuid/book.pdf",
  "uploadedAt": "2025-01-15T10:30:00Z",
  "approvedAt": "2025-01-15T11:00:00Z",
  "approvedBy": "admin-uuid",
  "GSI1PK": "TITLE#aws-serverless-guide",
  "GSI1SK": "BOOK#uuid",
  "GSI2PK": "AUTHOR#john-doe",
  "GSI2SK": "BOOK#uuid"
}
```

2. **Audit Log**:
```json
{
  "PK": "BOOK#uuid",
  "SK": "AUDIT#2025-01-15T11:00:00Z",
  "action": "APPROVED|REJECTED|UPLOADED",
  "actorId": "admin-uuid",
  "actorEmail": "admin@example.com",
  "timestamp": "2025-01-15T11:00:00Z",
  "reason": "Copyright violation"
}
```

### S3 Bucket Structure

```
online-library-bucket/
├── uploads/              # Pending files (auto-delete after 72h)
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

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "requestId": "uuid",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Common Error Codes

| HTTP Status | Error Code             | Description             |
| ----------- | ---------------------- | ----------------------- |
| 400         | INVALID_REQUEST        | Request không hợp lệ    |
| 401         | UNAUTHORIZED           | JWT token không hợp lệ  |
| 403         | FORBIDDEN              | Không có quyền truy cập |
| 404         | NOT_FOUND              | Resource không tồn tại  |
| 413         | FILE_TOO_LARGE         | File > 50MB             |
| 415         | UNSUPPORTED_MEDIA_TYPE | MIME type không hợp lệ  |
| 429         | TOO_MANY_REQUESTS      | Vượt rate limit         |
| 500         | INTERNAL_ERROR         | Lỗi server              |

### Lambda Error Handling Pattern

```python
import json
import traceback
from datetime import datetime

def lambda_handler(event, context):
    try:
        # Business logic
        return success_response(200, {'message': 'Success'})
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
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'error': message,
            'code': error_code,
            'requestId': context.request_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        })
    }
```

## Security

### 1. Authentication & Authorization

- JWT token validation trên API Gateway
- Admin check trong Lambda: `cognito:groups` claim
- Token expiration: 1 hour (access), 30 days (refresh)

### 2. S3 Security

- Block all public access
- CloudFront OAC (Origin Access Control)
- Presigned URLs với TTL ngắn (15 min PUT, 1 hour GET)
- Bucket policy chỉ cho phép CloudFront và Lambda

**Bucket Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::online-library-bucket/public/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::account-id:distribution/distribution-id"
        }
      }
    }
  ]
}
```

### 3. IAM Least Privilege

Mỗi Lambda có role riêng với quyền tối thiểu:

```typescript
// createUploadUrl Lambda Role
const createUploadUrlRole = new iam.Role(this, 'CreateUploadUrlRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  ],
});

createUploadUrlRole.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:PutObject'],
  resources: ['arn:aws:s3:::online-library-bucket/uploads/*']
}));

createUploadUrlRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:PutItem'],
  resources: [table.tableArn]
}));
```

### 4. Input Validation

- File size: Max 50MB
- File type: PDF, ePub only (validate magic bytes)
- Sanitize strings: title, author, description
- Rate limiting: API Gateway throttling

### 5. CORS

```typescript
corsPreflight: {
  allowOrigins: ['https://yourdomain.com'],
  allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: Duration.hours(1),
}
```

## Monitoring and Logging

### CloudWatch Logs

**Log Groups**:
- `/aws/lambda/createUploadUrl`
- `/aws/lambda/approveBook`
- `/aws/lambda/getReadUrl`
- `/aws/lambda/searchBooks`
- `/aws/lambda/validateMimeType`

**Log Retention**: 14 days

**Structured Logging**:
```python
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

logger.info(json.dumps({
    'requestId': context.request_id,
    'userId': user_id,
    'action': 'CREATE_UPLOAD_URL',
    'bookId': book_id,
    'timestamp': datetime.utcnow().isoformat() + 'Z',
    'status': 'success'
}))
```

### CloudWatch Alarms

1. **Lambda Error Rate**:
   - Metric: `Errors / Invocations`
   - Threshold: > 5%
   - Action: SNS notification

2. **API Gateway 4xx/5xx**:
   - Metric: `4XXError`, `5XXError`
   - Threshold: > 10 in 5 minutes
   - Action: SNS notification

3. **DynamoDB Throttling**:
   - Metric: `UserErrors`
   - Threshold: > 0
   - Action: SNS notification

### AWS Budget Alerts

- Alert when cost > $10/month
- Alert when cost > $20/month (critical)

## Deployment

### CDK Stack Structure

```
cdk/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   ├── cognito-stack.ts       # Cognito User Pool
│   ├── database-stack.ts      # DynamoDB table
│   ├── storage-stack.ts       # S3 buckets + Lifecycle
│   ├── api-stack.ts           # API Gateway + Lambda
│   ├── cdn-stack.ts           # CloudFront distribution
│   └── monitoring-stack.ts    # CloudWatch alarms
└── lambda/
    ├── create-upload-url/     # POST /books/upload-url
    ├── validate-mime-type/    # S3 Event trigger
    ├── list-pending-books/    # GET /admin/books/pending
    ├── approve-book/          # POST /admin/books/{id}/approve
    ├── reject-book/           # POST /admin/books/{id}/reject
    ├── get-my-uploads/        # GET /books/my-uploads
    ├── get-read-url/          # GET /books/{id}/read-url
    └── search-books/          # GET /books/search
```

### Deployment Commands

```bash
# Bootstrap CDK (first time only)
cdk bootstrap

# Synthesize CloudFormation
cdk synth

# Deploy all stacks
cdk deploy --all

# Deploy specific stack
cdk deploy CognitoStack

# Destroy all stacks
cdk destroy --all
```

### Environment Configuration

```typescript
// cdk.json
{
  "context": {
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
}
```

## Cost Estimation

| Service     | Monthly Cost (USD) | Notes                         |
| ----------- | ------------------ | ----------------------------- |
| CloudFront  | $0.86              | 10 GB egress + 10K requests   |
| API Gateway | $0.01              | 10K HTTP API calls            |
| Lambda      | $0.00              | 128 MB × 100 ms × 10K invokes |
| S3          | $0.05              | 2 GB storage                  |
| DynamoDB    | $0.03              | On-Demand, light usage        |
| Cognito     | $5.00              | 100 MAU                       |
| CloudWatch  | $1.64              | 5 metrics + 0.1 GB logs       |
| Route 53    | $0.90              | 1 Hosted Zone                 |
| **Total**   | **≈ $9.80/month**  | MVP (100 users)               |

## Testing Strategy

### Unit Tests

- Test Lambda functions với mocked AWS services (moto)
- Test business logic riêng biệt
- Coverage target: > 80%

### Integration Tests

- Test end-to-end flows với AWS SAM Local
- Test API Gateway + Lambda integration
- Test DynamoDB queries

### Load Tests

- Test concurrent uploads
- Test API rate limiting
- Test DynamoDB throughput


## Frontend Architecture

### Component Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page (book list)
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── signup/
│   │   │   └── page.tsx        # Signup page
│   │   ├── upload/
│   │   │   └── page.tsx        # Upload page
│   │   ├── admin/
│   │   │   └── page.tsx        # Admin dashboard
│   │   └── books/
│   │       └── [id]/
│   │           └── page.tsx    # Book reader
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── books/
│   │   │   ├── BookCard.tsx
│   │   │   ├── BookList.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── BookReader.tsx
│   │   ├── upload/
│   │   │   ├── UploadForm.tsx
│   │   │   └── FileUploader.tsx
│   │   └── admin/
│   │       ├── PendingBookList.tsx
│   │       └── ApprovalActions.tsx
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   ├── auth.ts             # Auth utilities
│   │   └── cognito.ts          # Cognito config
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBooks.ts
│   │   └── useUpload.ts
│   └── types/
│       └── index.ts            # TypeScript types
├── public/
│   └── images/
└── amplify.yml                 # Amplify build config
```

### Frontend Components

#### 1. Authentication Components

**LoginForm.tsx**:
```typescript
'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>
      
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

**ProtectedRoute.tsx**:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedRoute({ 
  children,
  requireAdmin = false 
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (requireAdmin && !isAdmin) {
        router.push('/');
      }
    }
  }, [user, loading, isAdmin, requireAdmin, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || (requireAdmin && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
}
```

#### 2. Upload Components

**UploadForm.tsx**:
```typescript
'use client';

import { useState } from 'react';
import { uploadBook } from '@/lib/api';
import FileUploader from './FileUploader';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // Step 1: Get Presigned URL
      const { uploadUrl, bookId } = await uploadBook({
        fileName: file.name,
        fileSize: file.size,
        title,
        author,
        description,
      });

      // Step 2: Upload to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        },
      });

      alert('Upload successful! Your book is pending approval.');
      // Reset form
      setFile(null);
      setTitle('');
      setAuthor('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FileUploader file={file} setFile={setFile} />
      
      <div>
        <label className="block text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Author</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      </div>

      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? `Uploading... ${progress}%` : 'Upload Book'}
      </button>
    </form>
  );
}
```

#### 3. Book Reader Component

**BookReader.tsx**:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getReadUrl } from '@/lib/api';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function BookReader({ bookId }: { bookId: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBook();
  }, [bookId]);

  const loadBook = async () => {
    try {
      const { readUrl } = await getReadUrl(bookId);
      setPdfUrl(readUrl);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load book');
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  if (loading) return <div>Loading book...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!pdfUrl) return null;

  return (
    <div className="flex flex-col items-center">
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div>Loading PDF...</div>}
      >
        <Page pageNumber={pageNumber} />
      </Document>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Previous
        </button>
        
        <span>
          Page {pageNumber} of {numPages}
        </span>
        
        <button
          onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
          disabled={pageNumber >= numPages}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

#### 4. Admin Components

**PendingBookList.tsx**:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { getPendingBooks, approveBook, rejectBook } from '@/lib/api';

interface Book {
  bookId: string;
  title: string;
  author: string;
  uploader: string;
  uploadedAt: string;
  fileSize: number;
}

export default function PendingBookList() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const data = await getPendingBooks();
      setBooks(data.books);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookId: string) => {
    if (!confirm('Are you sure you want to approve this book?')) return;

    try {
      await approveBook(bookId);
      alert('Book approved successfully!');
      loadBooks(); // Refresh list
    } catch (err: any) {
      alert(err.message || 'Failed to approve book');
    }
  };

  const handleReject = async (bookId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await rejectBook(bookId, reason);
      alert('Book rejected successfully!');
      loadBooks(); // Refresh list
    } catch (err: any) {
      alert(err.message || 'Failed to reject book');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Pending Books</h2>
      
      {books.length === 0 ? (
        <p>No pending books</p>
      ) : (
        <div className="grid gap-4">
          {books.map((book) => (
            <div key={book.bookId} className="border rounded-lg p-4">
              <h3 className="text-xl font-semibold">{book.title}</h3>
              <p className="text-gray-600">by {book.author}</p>
              <p className="text-sm text-gray-500">
                Uploaded by {book.uploader} on {new Date(book.uploadedAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                Size: {(book.fileSize / 1024 / 1024).toFixed(2)} MB
              </p>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleApprove(book.bookId)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(book.bookId)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Frontend API Client

**lib/api.ts**:
```typescript
import axios from 'axios';
import { getAccessToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      // If refresh fails, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const uploadBook = async (data: {
  fileName: string;
  fileSize: number;
  title: string;
  author: string;
  description?: string;
}) => {
  const response = await apiClient.post('/books/upload-url', data);
  return response.data;
};

export const getReadUrl = async (bookId: string) => {
  const response = await apiClient.get(`/books/${bookId}/read-url`);
  return response.data;
};

export const searchBooks = async (query: { title?: string; author?: string }) => {
  const response = await apiClient.get('/books/search', { params: query });
  return response.data;
};

export const getPendingBooks = async () => {
  const response = await apiClient.get('/admin/books/pending');
  return response.data;
};

export const approveBook = async (bookId: string) => {
  const response = await apiClient.post(`/admin/books/${bookId}/approve`);
  return response.data;
};

export const rejectBook = async (bookId: string, reason: string) => {
  const response = await apiClient.post(`/admin/books/${bookId}/reject`, { reason });
  return response.data;
};
```

### Amplify Configuration

**amplify.yml**:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

**Environment Variables** (Amplify Console):
```
NEXT_PUBLIC_API_URL=https://api.library.example.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-southeast-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=ap-southeast-1
```

### Frontend Routing

| Route       | Component        | Auth Required | Admin Only |
| ----------- | ---------------- | ------------- | ---------- |
| /           | Home (Book List) | No            | No         |
| /login      | Login            | No            | No         |
| /signup     | Signup           | No            | No         |
| /upload     | Upload Form      | Yes           | No         |
| /books/[id] | Book Reader      | Yes           | No         |
| /admin      | Admin Dashboard  | Yes           | Yes        |

### State Management

**useAuth Hook**:
```typescript
import { useState, useEffect, createContext, useContext } from 'react';
import { getCurrentUser, signOut as cognitoSignOut } from '@/lib/auth';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Check if user is admin
      const groups = currentUser?.signInUserSession?.accessToken?.payload['cognito:groups'] || [];
      setIsAdmin(groups.includes('Admins'));
    } catch (err) {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await cognitoSignOut();
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

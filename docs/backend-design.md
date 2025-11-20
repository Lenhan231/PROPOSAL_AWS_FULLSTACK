**# Backend Design - Thư Viện Online

## Overview

Tài liệu này mô tả thiết kế chi tiết **backend** cho hệ thống Thư Viện Online - một nền tảng serverless trên AWS.

### Design Goals

1. **Serverless-first**: Không quản lý servers, auto-scaling, pay-per-use
2. **Cost-effective**: Chi phí ≈ $9.80/tháng cho MVP (100 users)
3. **Secure**: JWT authentication, Signed URLs, OAC, least privilege IAM
4. **Scalable**: Có thể scale lên 5,000-50,000 users
5. **Simple**: Sử dụng managed services, ít operational overhead

### Technology Stack

- **IaC**: AWS CDK (Python)
- **Auth**: Amazon Cognito User Pools
- **API**: API Gateway HTTP API
- **Compute**: AWS Lambda (Python 3.11)
- **Database**: DynamoDB (On-Demand)
- **Storage**: Amazon S3
- **CDN**: Amazon CloudFront
- **Monitoring**: CloudWatch Logs, Alarms, AWS Budgets

## Architecture

### High-Level Architecture

```
User/Admin
    ↓
API Gateway (HTTP API) → JWT validation
    ↓
Lambda Functions → Business logic
    ↓ ↓ ↓
[Cognito] [DynamoDB] [S3]
    ↓
CloudFront → Content delivery (Signed URLs)
    ↓
CloudWatch → Monitoring & Logging
```

### Request Flows

**1. Authentication Flow:**
```
User → Cognito → JWT tokens → Store in client
```

**2. Upload Flow:**
```
User → API Gateway → createUploadUrl Lambda → Presigned URL
User → S3 (direct upload) → S3 Event → validateMimeType Lambda
```

**3. Approval Flow:**
```
Admin → API Gateway → approveBook Lambda → Copy S3 + Update DDB
```

**4. Read Flow:**
```
User → API Gateway → getReadUrl Lambda → CloudFront Signed URL
User → CloudFront → S3 (via OAC)
```

**5. Search Flow:**
```
User → API Gateway → searchBooks Lambda → DynamoDB GSI Query
```

## API Endpoints

| Method | Path                          | Lambda           | Auth     | Description               |
| ------ | ----------------------------- | ---------------- | -------- | ------------------------- |
| POST   | /books/upload-url             | createUploadUrl  | Required | Tạo Presigned PUT URL     |
| GET    | /books/{bookId}/read-url      | getReadUrl       | Required | Tạo CloudFront Signed URL |
| GET    | /books/search                 | searchBooks      | Required | Tìm kiếm sách             |
| GET    | /books/my-uploads             | getMyUploads     | Required | Xem uploads của user      |
| GET    | /admin/books/pending          | listPendingBooks | Admin    | Lấy danh sách pending     |
| POST   | /admin/books/{bookId}/approve | approveBook      | Admin    | Duyệt sách                |
| POST   | /admin/books/{bookId}/reject  | rejectBook       | Admin    | Từ chối sách              |

**Note**: Tất cả path parameters đều dùng `{bookId}` để consistent.

### Error Handling & Response Format

Để đồng bộ với frontend, tất cả lỗi từ API Gateway/Lambda (bao gồm lỗi validation 4xx, lỗi auth 401/403 và lỗi hệ thống 5xx) **phải** trả về JSON theo cấu trúc chuẩn `ApiError`:

```json
{
  "error": "File size exceeds 50MB",
  "code": "FILE_TOO_LARGE",
  "requestId": "uuid",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

- `error`: Thông điệp lỗi human-friendly cho người dùng.
- `code`: Mã lỗi machine-readable để frontend map UI/logic.
- `requestId`: ID request (API Gateway requestId hoặc Lambda invocationId) để trace log.
- `timestamp`: Thời gian phát sinh lỗi (UTC, ISO-8601).

**Danh sách mã lỗi chuẩn** (align với frontend `ApiErrorCode`):

```text
INVALID_REQUEST
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
FILE_TOO_LARGE
UNSUPPORTED_MEDIA_TYPE
TOO_MANY_REQUESTS
INTERNAL_ERROR
```

**Quy ước mapping HTTP status → code (khuyến nghị):**

- `400 Bad Request` → `INVALID_REQUEST` (validation, tham số sai, query/body không hợp lệ).
- `401 Unauthorized` → `UNAUTHORIZED` (chưa login, JWT hết hạn hoặc không hợp lệ).
- `403 Forbidden` → `FORBIDDEN` (không đủ quyền, ví dụ non-admin gọi `/admin/...`).
- `404 Not Found` → `NOT_FOUND` (bookId không tồn tại hoặc đã bị xóa).
- `413 Payload Too Large` hoặc `400` khi file > 50MB → `FILE_TOO_LARGE`.
- `415 Unsupported Media Type` → `UNSUPPORTED_MEDIA_TYPE` (MIME type không phải PDF/ePub).
- `429 Too Many Requests` → `TOO_MANY_REQUESTS` (throttling/rate limiting).
- Tất cả lỗi `5xx` (unhandled exception, lỗi hệ thống) → `INTERNAL_ERROR`.

**Implementation note:**

- Mỗi Lambda HTTP handler sẽ catch exception và trả về object `ApiError` theo format trên (thông qua `statusCode`, `headers`, `body`), **không dùng** format lỗi mặc định của API Gateway.
- Các lỗi từ Cognito/DynamoDB/S3 sẽ được map sang các `code` chuẩn trước khi trả về client.

## Lambda Functions

**Tổng cộng: 7 Lambda functions**

1. **createUploadUrl** - Tạo Presigned PUT URL + Book Metadata draft (status: UPLOADING + TTL)
2. **validateMimeType** - Validate MIME type (S3 trigger)
3. **listPendingBooks** - Admin xem danh sách pending (query GSI5)
4. **approveBook** - Admin duyệt sách
5. **rejectBook** - Admin từ chối sách (XÓA file + update status)
6. **getMyUploads** - User xem uploads của mình (query GSI6)
7. **getReadUrl** - Tạo CloudFront Signed URL
8. **searchBooks** - Tìm kiếm sách (title HOẶC author)

**Key Changes:**
- ✅ Removed Upload Sessions entity
- ✅ createUploadUrl creates Book Metadata immediately
- ✅ listPendingBooks uses GSI5 (no table scan!)
- ✅ getMyUploads uses GSI6 (returns full Book Metadata)
- ✅ searchBooks only supports 1 field at a time

### Lambda Function Details

#### 1. createUploadUrl

**Input** (POST /books/upload-url):
```json
{
  "fileName": "book.pdf",
  "fileSize": 5242880,
  "title": "AWS Serverless Guide",
  "author": "John Doe",
  "description": "A comprehensive guide"
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
1. Extract userId from JWT claims
2. Validate file size (≤ 50MB) and extension (.pdf, .epub)
3. Generate bookId (UUID)
aws cognito-idp admin-get-user --user-pool-id ap-southeast-1_SKkoJraD3 --username testuser@example.com 2>&1 | grep -i status

4. Create Presigned PUT URL (TTL 15 min)
5. **Create Book Metadata draft trong DynamoDB** với:
   - `status=UPLOADING`
   - `ttl` = now + 72h (DynamoDB TTL để auto dọn dẹp nếu user không upload file)
   - Lưu sẵn `bookId`, `title`, `author`, `description`, `uploaderId`, `uploaderEmail`, `s3Key`
   - **Set trước** `GSI6PK=UPLOADER#userId`, `GSI6SK=BOOK#bookId` để `getMyUploads` luôn thấy record ở trạng thái `UPLOADING`
   - **KHÔNG** set `GSI5PK/GSI5SK` (status) ở bước này (admin pending list chỉ thấy sách đã upload file hợp lệ)
6. Return uploadUrl + bookId

#### 2. validateMimeType

**Trigger**: S3 Event when file uploaded to `uploads/`

**Logic**:
1. Download first 4KB of file
2. Check magic bytes (python-magic library)
3. If valid (PDF/ePub):
   - Update Book Metadata:
     - `status = PENDING`
     - Set `uploadedAt`, `fileSize`, `s3Key`
     - Set `GSI5PK=STATUS#PENDING`, `GSI5SK=uploadedAt` (để `listPendingBooks` query)
     - Set `GSI6PK=UPLOADER#userId`, `GSI6SK=BOOK#bookId` (để `getMyUploads` query)
     - Xóa trường `ttl` để item **không** bị TTL xóa
4. If invalid:
   - Delete file from S3
   - Update Book Metadata:
     - `status = REJECTED_INVALID_TYPE`
     - Set `uploadedAt` (thời điểm upload thất bại)
     - Set `GSI6PK=UPLOADER#userId`, `GSI6SK=BOOK#bookId` (user vẫn thấy trong `my-uploads`)
     - Xóa trường `ttl`

#### 3. listPendingBooks

**Input** (GET /admin/books/pending?page=1&pageSize=20):
```json
{
  "page": 1,
  "pageSize": 20
}
```

**Output**:
```json
{
  "data": [
    {
      "bookId": "uuid",
      "title": "Book Title",
      "author": "Author",
      "description": "Optional short description",
      "uploader": "user@example.com",
      "uploadedAt": "2025-01-15T10:30:00Z",
      "fileSize": 5242880
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

**Logic**:
1. Check admin permission (cognito:groups)
2. Query GSI5 (GSI5PK=STATUS#PENDING) → chỉ trả về books đã upload file thành công (do GSI5 chỉ được set trong `validateMimeType`)
3. Sort by uploadedAt descending
4. Map result sang DTO `PendingBook`:
   - `bookId`, `title`, `author`, `description`, `uploadedAt` lấy từ Book Metadata
   - `uploader` map từ `uploaderEmail`
   - `fileSize` lấy từ `fileSize`
5. Return với pagination metadata

#### 4. approveBook

**Input** (POST /admin/books/{bookId}/approve):
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
1. Check admin permission
2. Get book metadata from DynamoDB
3. Copy file from `uploads/` to `public/books/`
4. Delete file from `uploads/`
5. Update DynamoDB: status=APPROVED, approvedAt, approvedBy
6. Write audit log

#### 5. rejectBook

**Input** (POST /admin/books/{bookId}/reject):
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
1. Check admin permission
2. Get book metadata
3. **DELETE file from S3**
4. Update DynamoDB: status=REJECTED, rejectedAt, rejectedBy, rejectedReason
5. Write audit log

#### 6. getMyUploads

**Input** (GET /books/my-uploads?page=1&pageSize=20):
```json
{
  "page": 1,
  "pageSize": 20
}
```

**Output**:
```json
{
  "data": [
    {
      "bookId": "uuid-1",
      "title": "My Approved Book",
      "author": "John Doe",
      "status": "APPROVED",
      "uploadedAt": "2025-01-15T10:30:00Z",
      "approvedAt": "2025-01-15T11:00:00Z"
    },
    {
      "bookId": "uuid-2",
      "title": "My Pending Book",
      "author": "John Doe",
      "status": "PENDING",
      "uploadedAt": "2025-01-14T10:30:00Z"
    },
    {
      "bookId": "uuid-3",
      "title": "My Rejected Book",
      "author": "John Doe",
      "status": "REJECTED",
      "uploadedAt": "2025-01-13T10:30:00Z",
      "rejectedAt": "2025-01-13T11:00:00Z",
      "rejectedReason": "Copyright violation"
    },
    {
      "bookId": "uuid-4",
      "title": "Invalid File Type",
      "author": "John Doe",
      "status": "REJECTED_INVALID_TYPE",
      "uploadedAt": "2025-01-12T10:30:00Z"
    }
  ],
  "meta": {
    "total": 4,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

**Logic**:
1. Extract userId from JWT
2. Query GSI6 (GSI6PK=UPLOADER#userId)
3. Sort by uploadedAt descending
4. Map result sang DTO `MyUpload`:
   - `bookId`, `title`, `author`, `description`, `uploadedAt` lấy từ Book Metadata
   - `status` lấy từ `status` (có thể là `UPLOADING`, `PENDING`, `APPROVED`, `REJECTED`, `REJECTED_INVALID_TYPE`)
   - `approvedAt` lấy từ `approvedAt` (nếu status=APPROVED)
   - `rejectedAt` và `rejectedReason` lấy từ Book Metadata (nếu status=REJECTED)
5. Return với pagination metadata

#### 7. getReadUrl

**Input** (GET /books/{bookId}/read-url):
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
1. Get book metadata from DynamoDB
2. Check status = APPROVED (else 403)
3. Create CloudFront Signed URL (TTL 1 hour)
4. Return signed URL

#### 8. searchBooks

**Input Option 1** (GET /books/search?title=aws&page=1&pageSize=20):
```json
{
  "title": "aws",
  "page": 1,
  "pageSize": 20
}
```

**Input Option 2** (GET /books/search?author=john&page=1&pageSize=20):
```json
{
  "author": "john",
  "page": 1,
  "pageSize": 20
}
```

**Output** (same for both):
```json
{
  "data": [
    {
      "bookId": "uuid",
      "title": "AWS Serverless Guide",
      "author": "John Doe",
      "description": "A comprehensive guide",
      "uploadedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  }
}
```

**Logic**:
1. Validate: Must have title OR author (not both, not neither)
2. If title: Query GSI1 (GSI1PK=TITLE#{normalized})
3. If author: Query GSI2 (GSI2PK=AUTHOR#{normalized})
4. Filter: Only return status=APPROVED
5. Return with pagination metadata

**Validation Rules**:
- ❌ Both title AND author → 400 Bad Request
- ❌ Neither title nor author → 400 Bad Request
- ✅ Only title → Query GSI1
- ✅ Only author → Query GSI2

**Note**: Chỉ accept title HOẶC author, không cả 2

## Data Models

### DynamoDB Single-Table Design

**Table Name**: `OnlineLibrary` (1 bảng duy nhất cho tất cả entities)

**Primary Key**:
- PK (Partition Key): String
- SK (Sort Key): String

**Global Secondary Indexes (GSIs)**:
- **GSI1**: Title search (GSI1PK, GSI1SK)
- **GSI2**: Author search (GSI2PK, GSI2SK)
- **GSI3**: Email lookup (GSI3PK, GSI3SK)
- **GSI4**: User's shelves & books (GSI4PK, GSI4SK) *(Future, không triển khai trong MVP)*
- **GSI5**: Status query (GSI5PK, GSI5SK) - For admin pending list
- **GSI6**: Uploader query (GSI6PK, GSI6SK) - For user's uploads

### Entity Types

#### 1. Book Metadata
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
  "status": "UPLOADING|PENDING|APPROVED|REJECTED|REJECTED_INVALID_TYPE",
  "fileSize": 5242880,
  "s3Key": "uploads/uuid/book.pdf",
  "uploadedAt": "2025-01-15T10:30:00Z",
  "approvedAt": "2025-01-15T11:00:00Z",
  "approvedBy": "admin-uuid",
  "rejectedAt": "2025-01-13T11:00:00Z",
  "rejectedReason": "Copyright violation",
  "ttl": 1736944800,
  "GSI1PK": "TITLE#aws-serverless-guide",
  "GSI1SK": "BOOK#uuid",
  "GSI2PK": "AUTHOR#john-doe",
  "GSI2SK": "BOOK#uuid",
  "GSI5PK": "STATUS#PENDING",
  "GSI5SK": "2025-01-15T10:30:00Z",
  "GSI6PK": "UPLOADER#user-uuid",
  "GSI6SK": "BOOK#uuid"
}
```

#### 2. Audit Logs
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

#### 3. User Profiles
```json
{
  "PK": "USER#user-uuid",
  "SK": "PROFILE",
  "userId": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER|ADMIN",
  "createdAt": "2025-01-01T00:00:00Z",
  "lastLoginAt": "2025-01-15T10:00:00Z",
  "GSI3PK": "EMAIL#user@example.com",
  "GSI3SK": "USER#user-uuid"
}
```

#### 4. Shelves (User's Collections)
```json
{
  "PK": "USER#user-uuid",
  "SK": "SHELF#favorites",
  "shelfId": "favorites",
  "shelfName": "My Favorites",
  "description": "Books I love",
  "createdAt": "2025-01-10T00:00:00Z",
  "bookCount": 5
}
```

#### 5. Shelf Items (Books in Shelf)
```json
{
  "PK": "SHELF#favorites",
  "SK": "BOOK#book-uuid",
  "bookId": "book-uuid",
  "addedAt": "2025-01-15T10:00:00Z",
  "GSI4PK": "USER#user-uuid",
  "GSI4SK": "SHELF#favorites#BOOK#book-uuid"
}
```

> **MVP Scope Note**: Các entity `Shelves` và `Shelf Items` cùng với GSI4 chỉ là thiết kế chuẩn bị cho future feature "Bookmarks/Favorites". Chúng **không được triển khai** trong MVP (không tạo GSI4, không có API tương ứng) cho đến khi frontend implement tính năng này.

### Access Patterns

| Access Pattern         | Method                                     |
| ---------------------- | ------------------------------------------ |
| Get book metadata      | `get_item(PK=BOOK#id, SK=METADATA)`        |
| Get book audit logs    | `query(PK=BOOK#id, SK begins_with AUDIT#)` |
| Search by title        | `query(GSI1, GSI1PK=TITLE#title)`          |
| Search by author       | `query(GSI2, GSI2PK=AUTHOR#author)`        |
| **Get pending books**  | `query(GSI5, GSI5PK=STATUS#PENDING)`       |
| **Get user's uploads** | `query(GSI6, GSI6PK=UPLOADER#userId)`      |
| Get user profile       | `get_item(PK=USER#id, SK=PROFILE)`         |
| Get user's shelves (*) | `query(PK=USER#id, SK begins_with SHELF#)` |
| Get books in shelf (*) | `query(PK=SHELF#id, SK begins_with BOOK#)` |
| Lookup by email        | `query(GSI3, GSI3PK=EMAIL#email)`          |

**Note**:
- Search chỉ hỗ trợ 1 field tại 1 thời điểm (title HOẶC author, không phải cả 2).
- Các access pattern đánh dấu (*) thuộc feature "Shelves/Favorites" và **không nằm trong scope MVP**.

### Query Examples

```python
# 1. Get book metadata
response = table.get_item(
    Key={'PK': 'BOOK#123', 'SK': 'METADATA'}
)
# Returns: Single book metadata item

# 2. Get book with audit logs
response = table.query(
    KeyConditionExpression='PK = :pk',
    ExpressionAttributeValues={':pk': 'BOOK#123'}
)
# Returns: book metadata + all audit logs (multiple items)

# 3. Search by title
response = table.query(
    IndexName='GSI1',
    KeyConditionExpression='GSI1PK = :pk',
    ExpressionAttributeValues={':pk': 'TITLE#aws-serverless-guide'}
)
# Returns: All books with matching title

# 4. Search by author
response = table.query(
    IndexName='GSI2',
    KeyConditionExpression='GSI2PK = :pk',
    ExpressionAttributeValues={':pk': 'AUTHOR#john-doe'}
)
# Returns: All books by matching author

# 5. Get pending books (Admin) - sorted by uploadedAt
response = table.query(
    IndexName='GSI5',
    KeyConditionExpression='GSI5PK = :pk',
    ExpressionAttributeValues={':pk': 'STATUS#PENDING'},
    ScanIndexForward=False  # Descending order (newest first)
)
# Returns: All pending books sorted by upload time

# 6. Get user's uploads - sorted by uploadedAt
response = table.query(
    IndexName='GSI6',
    KeyConditionExpression='GSI6PK = :pk',
    ExpressionAttributeValues={':pk': 'UPLOADER#user-456'},
    ScanIndexForward=False  # Descending order (newest first)
)
# Returns: All books uploaded by user

# 7. Get user profile
response = table.get_item(
    Key={'PK': 'USER#456', 'SK': 'PROFILE'}
)
# Returns: User profile

# 8. Get user's shelves
response = table.query(
    KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues={':pk': 'USER#456', ':sk': 'SHELF#'}
)
# Returns: All shelves for user

# 9. Get books in a shelf
response = table.query(
    KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues={':pk': 'SHELF#favorites', ':sk': 'BOOK#'}
)
# Returns: All books in shelf

# 10. Lookup user by email
response = table.query(
    IndexName='GSI3',
    KeyConditionExpression='GSI3PK = :pk',
    ExpressionAttributeValues={':pk': 'EMAIL#user@example.com'}
)
# Returns: User profile by email

# 11. Conditional update (prevent race condition)
response = table.update_item(
    Key={'PK': 'BOOK#123', 'SK': 'METADATA'},
    UpdateExpression='SET #status = :newStatus',
    ConditionExpression='#status = :oldStatus',
    ExpressionAttributeNames={'#status': 'status'},
    ExpressionAttributeValues={
        ':newStatus': 'APPROVED',
        ':oldStatus': 'PENDING'
    }
)
# Only updates if current status is PENDING

# 12. Batch get items (for multiple books)
response = dynamodb.batch_get_item(
    RequestItems={
        'OnlineLibrary': {
            'Keys': [
                {'PK': 'BOOK#123', 'SK': 'METADATA'},
                {'PK': 'BOOK#456', 'SK': 'METADATA'},
                {'PK': 'BOOK#789', 'SK': 'METADATA'}
            ]
        }
    }
)
# Returns: Multiple book metadata items in one call
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
```

**File Deletion Flow:**

1. **Admin REJECT** → File bị XÓA NGAY từ `uploads/`
2. **Admin APPROVE** → File được copy sang `public/books/` và XÓA khỏi `uploads/`
3. **Pending > 72h** → S3 Lifecycle Policy tự động XÓA từ `uploads/`
4. **Không upload file sau khi lấy upload URL** → DynamoDB TTL (`ttl` trên Book Metadata với `status=UPLOADING`) tự động xóa record "mồ côi" sau ~72h

**Kết luận**: File trong `uploads/` sẽ bị xóa trong các trường hợp trên; các Book Metadata "mồ côi" (user không upload file) cũng được dọn dẹp tự động bằng TTL. Chỉ file APPROVED được lưu lâu dài trong `public/books/`.

## Security

### Authentication & Authorization
- JWT token validation trên API Gateway
- Admin check: `cognito:groups` claim
- Token TTL: 1 hour (access), 30 days (refresh)

### S3 Security
- Block all public access
- CloudFront OAC only
- Presigned URLs: 15 min (PUT), 1 hour (GET)

### IAM Least Privilege
Mỗi Lambda có role riêng với quyền tối thiểu

### Input Validation
- File size: Max 50MB
- File type: PDF, ePub (magic bytes validation)
- Sanitize user inputs

## Monitoring

### CloudWatch Logs
- Log retention: 14 days
- Structured logging (JSON format)

### CloudWatch Alarms
- Lambda error rate > 5%
- API 4xx/5xx errors
- DynamoDB throttling

### AWS Budget Alerts
- Alert at $10/month
- Critical alert at $20/month

## Cost Estimation

| Service     | Monthly Cost |
| ----------- | ------------ |
| CloudFront  | $0.86        |
| API Gateway | $0.01        |
| Lambda      | $0.00        |
| S3          | $0.05        |
| DynamoDB    | $0.03        |
| Cognito     | $5.00        |
| CloudWatch  | $1.64        |
| Route 53    | $0.90        |
| **Total**   | **$9.80**    |

## Deployment

### CDK Stack Structure

```
cdk/
├── bin/
│   └── app.py                 # CDK app entry point
├── lib/stack/
│   ├── cognito_stack.py       # Cognito User Pool
│   ├── database_stack.py      # DynamoDB table
│   ├── storage_stack.py       # S3 buckets
│   ├── api_stack.py           # API Gateway + Lambda
│   ├── cdn_stack.py           # CloudFront
│   └── monitoring_stack.py    # CloudWatch
└── lambda/
    ├── create_upload_url/
    ├── validate_mime_type/
    ├── list_pending_books/
    ├── approve_book/
    ├── reject_book/
    ├── get_my_uploads/
    ├── get_read_url/
    └── search_books/
```

### Deployment Commands

```bash
# Bootstrap CDK
cdk bootstrap

# Deploy all stacks
cdk deploy --all

# Deploy specific stack
cdk deploy ApiStack

# Destroy
cdk destroy --all
```

## Testing Strategy

### Unit Tests
- Test Lambda functions với mocked AWS services (moto)
- Coverage target: > 80%

### Integration Tests
- Test end-to-end flows với AWS SAM Local
- Test API Gateway + Lambda integration

### Load Tests
- Test concurrent uploads
- Test API rate limiting
- Test DynamoDB throughput

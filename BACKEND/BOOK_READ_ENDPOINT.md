# Book Read URL API Documentation

## Overview
This endpoint provides pre-signed S3 URLs for online book reading. Users can view PDFs directly in their browser without downloading.

## Endpoint

### GET /books/{bookId}/read-url

Returns a pre-signed S3 URL for reading a book online.

**Authentication:** Required - JWT Bearer token in Authorization header

**Path Parameters:**
- `bookId` (string, required): The unique identifier of the book

**Query Parameters (Optional):**
- `responseContentDisposition` (string): Controls how browser handles the file
  - `inline` (default): View in browser
  - `attachment`: Download file
  - Example: `?responseContentDisposition=inline`

**Request Example:**
```http
GET /books/abc-123-def/read-url?responseContentDisposition=inline
Authorization: Bearer <JWT_TOKEN>
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "url": "https://bucket-name.s3.amazonaws.com/books/abc-123-def.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "bookId": "abc-123-def",
  "title": "AWS Serverless Architecture",
  "author": "John Doe",
  "description": "A comprehensive guide...",
  "pages": 350,
  "fileSize": 5242880,
  "uploadDate": "2024-12-01T10:00:00Z",
  "expiresIn": 3600
}
```

**Alternative Response Format (also accepted):**
```json
{
  "readUrl": "https://bucket-name.s3.amazonaws.com/...",
  "bookId": "abc-123-def"
}
```

**Response Fields:**
- `url` or `readUrl` (string, required): Pre-signed S3 URL
- `bookId` (string): Book identifier
- `title` (string): Book title
- `author` (string): Book author
- `description` (string): Book description
- `pages` (number): Total pages
- `fileSize` (number): File size in bytes
- `uploadDate` (string): ISO 8601 timestamp
- `expiresIn` (number): URL expiration in seconds

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to read this book"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Book not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Failed to generate read URL"
}
```

---

## Implementation Requirements

### 1. Authorization Check
**Verify user can access the book:**
```python
def check_book_access(user_id, book_id):
    book = get_book_from_db(book_id)
    
    # Only approved books can be read by regular users
    if book['status'] != 'APPROVED':
        # Allow if user is admin OR book owner
        if not is_admin(user_id) and book['uploader_id'] != user_id:
            raise Forbidden("Book is not approved for reading")
    
    return book
```

### 2. S3 Pre-signed URL Generation
**Generate URL with proper parameters:**
```python
import boto3
from botocore.config import Config

s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))

def generate_read_url(book_id, content_disposition='inline'):
    # Get book metadata from DynamoDB
    book = get_book_from_db(book_id)
    
    # Generate pre-signed URL
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': os.environ['BOOKS_BUCKET'],
            'Key': f"books/{book_id}.pdf",
            'ResponseContentDisposition': content_disposition,
            'ResponseContentType': 'application/pdf'
        },
        ExpiresIn=3600  # 1 hour
    )
    
    return {
        'url': url,
        'bookId': book_id,
        'title': book.get('title'),
        'author': book.get('author'),
        'description': book.get('description'),
        'pages': book.get('pages'),
        'fileSize': book.get('fileSize'),
        'uploadDate': book.get('uploadDate'),
        'expiresIn': 3600
    }
```

### 3. Lambda Handler Example
```python
import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
table = dynamodb.Table(os.environ['BOOKS_TABLE'])

def lambda_handler(event, context):
    # Extract book_id from path
    book_id = event['pathParameters']['bookId']
    
    # Get user from JWT token
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    
    # Get optional query parameter
    params = event.get('queryStringParameters') or {}
    content_disposition = params.get('responseContentDisposition', 'inline')
    
    try:
        # Get book from DynamoDB
        response = table.get_item(Key={'book_id': book_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': cors_headers(),
                'body': json.dumps({'error': 'Book not found'})
            }
        
        book = response['Item']
        
        # Authorization check
        if book['status'] != 'APPROVED':
            # Check if user is admin or owner
            if not is_admin(user_id) and book['uploader_id'] != user_id:
                return {
                    'statusCode': 403,
                    'headers': cors_headers(),
                    'body': json.dumps({
                        'error': 'Forbidden',
                        'message': 'This book is not approved for reading'
                    })
                }
        
        # Generate pre-signed URL
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': os.environ['BOOKS_BUCKET'],
                'Key': f"books/{book_id}.pdf",
                'ResponseContentDisposition': content_disposition,
                'ResponseContentType': 'application/pdf'
            },
            ExpiresIn=3600
        )
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({
                'url': url,
                'bookId': book_id,
                'title': book.get('title'),
                'author': book.get('author'),
                'description': book.get('description'),
                'pages': book.get('pages'),
                'fileSize': book.get('file_size'),
                'uploadDate': book.get('upload_date'),
                'expiresIn': 3600
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers(),
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': 'Failed to generate read URL'
            })
        }

def is_admin(user_id):
    # Check if user has admin privileges
    # This could check Cognito groups or a database table
    pass

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    }
```

---

## S3 Configuration

### CORS Settings (Required)
Add this to your S3 bucket CORS configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": [
            "https://your-frontend-domain.com",
            "http://localhost:3000"
        ],
        "ExposeHeaders": [
            "Content-Length",
            "Content-Type",
            "Content-Disposition"
        ],
        "MaxAgeSeconds": 3600
    }
]
```

### Object Metadata
Ensure uploaded PDFs have correct metadata:
```python
# During upload
s3_client.put_object(
    Bucket=bucket_name,
    Key=f"books/{book_id}.pdf",
    Body=file_content,
    ContentType='application/pdf',
    ContentDisposition='inline',  # For browser viewing
    Metadata={
        'title': book_title,
        'author': book_author
    }
)
```

---

## Security Considerations

### 1. URL Expiration
- Recommended: **3600 seconds (1 hour)**
- Allows comfortable reading time
- Prevents URL sharing/abuse

### 2. Authorization
- Always verify book status = "APPROVED" for regular users
- Allow admin and owner to view pending books
- Check user authentication on every request

### 3. Rate Limiting
- Consider implementing rate limits: 100 requests/hour per user
- Prevents URL generation abuse

### 4. Logging
- Log all read URL generations
- Track user_id, book_id, timestamp
- Monitor for suspicious patterns

### 5. Content Protection
- URLs expire automatically
- Consider watermarking PDFs with user email
- Use CloudFront signed URLs for additional security (optional)

---

## Testing Checklist

### Authorization Tests
- [ ] Approved book → Regular user can read ✅
- [ ] Pending book → Regular user gets 403 ❌
- [ ] Pending book → Owner can read ✅
- [ ] Pending book → Admin can read ✅
- [ ] Non-existent book → 404 error ❌
- [ ] No token → 401 error ❌

### Functionality Tests
- [ ] URL works in browser (opens PDF)
- [ ] `responseContentDisposition=inline` → Views in browser
- [ ] `responseContentDisposition=attachment` → Downloads file
- [ ] URL expires after set time
- [ ] CORS headers allow frontend access
- [ ] Metadata (title, author) returned correctly

### Performance Tests
- [ ] Response time < 500ms
- [ ] Handles concurrent requests
- [ ] Large PDFs (>50MB) work correctly

---

## API Gateway Configuration

**Route:** `GET /books/{bookId}/read-url`

**Integration Type:** Lambda Proxy

**Authorizer:** JWT Authorizer (Cognito User Pool)

**CORS:** Enabled
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**Throttling:**
- Rate: 100 requests/second
- Burst: 200 requests

---

## Monitoring & Alerts

### CloudWatch Metrics to Monitor
1. **Invocation Count** - Track usage patterns
2. **Error Rate** - Alert if >1% errors
3. **Duration** - Alert if >500ms
4. **4xx Errors** - Track authorization failures
5. **5xx Errors** - Alert on any occurrence

### Recommended Alarms
```yaml
ReadURLErrors:
  Metric: Errors
  Threshold: > 10 in 5 minutes
  Action: SNS notification

ReadURLLatency:
  Metric: Duration
  Threshold: > 500ms average over 5 minutes
  Action: SNS notification
```

---

## Frontend Integration Notes

The frontend expects either format:
```javascript
// Format 1
{ url: "https://...", bookId: "...", title: "..." }

// Format 2
{ readUrl: "https://...", bookId: "..." }
```

Frontend handles both with:
```javascript
const signedUrl = result.url || result.readUrl;
```

---

## Questions?
Contact the frontend team or refer to:
- Frontend implementation: `pages/read/[bookId].js`
- API client: `lib/api.js`
- Constants: `lib/constants.js`

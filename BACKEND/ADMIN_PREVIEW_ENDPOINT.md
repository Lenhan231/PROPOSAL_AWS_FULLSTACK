# Admin Preview Endpoint - Implementation Guide

## Problem
Currently, admins cannot preview PENDING books before approving them. The regular `/books/{bookId}/read-url` endpoint only works for APPROVED books, causing previews from the admin dashboard to fail and redirect to the homepage.

## Solution
Create a new admin-only endpoint that allows admins to get signed S3 URLs for books regardless of their approval status.

---

## Endpoint Specification

### Route
```
GET /admin/books/{bookId}/preview-url
```

### Authentication
- **Required**: Yes (JWT token)
- **Authorization**: Admin only (check Cognito groups or admin email list)

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bookId` | string (UUID) | Yes | The ID of the book to preview |

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `responseContentDisposition` | string | No | `inline` | Either `inline` (view in browser) or `attachment` (download) |

### Headers
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Response Format

### Success Response (200)
```json
{
  "url": "https://s3.signed.url...",
  "title": "Book Title",
  "author": "Author Name",
  "description": "Book description",
  "uploadDate": "2025-12-02T10:30:00Z",
  "pages": 250,
  "status": "PENDING"
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authentication token"
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

**404 Not Found**
```json
{
  "error": "Not Found",
  "message": "Book not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to generate preview URL"
}
```

---

## Implementation Steps

### 1. Database Query
Query DynamoDB for the book with the given `bookId`:
- Do NOT filter by status (allow any status including PENDING, APPROVED, REJECTED)
- Retrieve all book metadata (title, author, description, S3 key, etc.)

### 2. Authorization Check
Verify the requesting user is an admin:
```python
def is_admin(event):
    """Check if user is admin via Cognito groups or email"""
    claims = event['requestContext']['authorizer']['claims']
    
    # Check Cognito groups
    groups = claims.get('cognito:groups', '')
    if 'Admins' in groups:
        return True
    
    # Check admin email list
    email = claims.get('email', '')
    admin_emails = ['nhanle221199@gmail.com']  # Load from environment
    if email in admin_emails:
        return True
    
    return False
```

### 3. Generate Signed URL
Generate a pre-signed S3 URL for the book's PDF:
```python
import boto3
from botocore.config import Config

s3_client = boto3.client(
    's3',
    config=Config(signature_version='s3v4', region_name='us-east-1')
)

def generate_preview_url(s3_key, content_disposition='inline', expires_in=3600):
    """Generate signed S3 URL for book preview"""
    params = {
        'Bucket': BOOKS_BUCKET,
        'Key': s3_key,
        'ResponseContentDisposition': content_disposition
    }
    
    url = s3_client.generate_presigned_url(
        'get_object',
        Params=params,
        ExpiresIn=expires_in  # 1 hour
    )
    
    return url
```

### 4. Response
Return the signed URL along with book metadata.

---

## Example Lambda Handler (Python)

```python
import json
import boto3
import os
from botocore.config import Config
from decimal import Decimal

BOOKS_TABLE = os.environ['BOOKS_TABLE']
BOOKS_BUCKET = os.environ['BOOKS_BUCKET']

dynamodb = boto3.resource('dynamodb')
books_table = dynamodb.Table(BOOKS_TABLE)

s3_client = boto3.client(
    's3',
    config=Config(signature_version='s3v4')
)

def decimal_to_int(obj):
    """Convert Decimal to int for JSON serialization"""
    if isinstance(obj, Decimal):
        return int(obj)
    raise TypeError

def lambda_handler(event, context):
    """
    Admin Preview URL Handler
    GET /admin/books/{bookId}/preview-url
    """
    try:
        # Extract bookId from path
        book_id = event['pathParameters']['bookId']
        
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        content_disposition = query_params.get('responseContentDisposition', 'inline')
        
        # Verify admin authorization
        claims = event['requestContext']['authorizer']['claims']
        if not is_admin(claims):
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Forbidden',
                    'message': 'Admin access required'
                })
            }
        
        # Get book from DynamoDB (any status)
        response = books_table.get_item(Key={'bookId': book_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Not Found',
                    'message': 'Book not found'
                })
            }
        
        book = response['Item']
        s3_key = book.get('s3Key')
        
        if not s3_key:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Internal Server Error',
                    'message': 'Book S3 key not found'
                })
            }
        
        # Generate signed URL
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BOOKS_BUCKET,
                'Key': s3_key,
                'ResponseContentDisposition': content_disposition
            },
            ExpiresIn=3600  # 1 hour
        )
        
        # Return response with book metadata
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'url': signed_url,
                'title': book.get('title', 'Unknown'),
                'author': book.get('author', 'Unknown'),
                'description': book.get('description', ''),
                'uploadDate': book.get('createdAt', book.get('uploadedAt', '')),
                'pages': book.get('pages'),
                'status': book.get('status', 'UNKNOWN')
            }, default=decimal_to_int)
        }
        
    except Exception as e:
        print(f'Error in admin preview: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(e)
            })
        }

def is_admin(claims):
    """Check if user has admin privileges"""
    # Check Cognito groups
    groups_str = claims.get('cognito:groups', '')
    if groups_str and 'Admins' in groups_str.split(','):
        return True
    
    # Check admin email list (load from environment in production)
    email = claims.get('email', '')
    admin_emails = os.environ.get('ADMIN_EMAILS', 'nhanle221199@gmail.com').split(',')
    if email in admin_emails:
        return True
    
    return False
```

---

## API Gateway Configuration

### Method
`GET`

### Integration Type
Lambda Function

### Lambda Function
`admin-preview-url-lambda` (or similar)

### Authorization
AWS_IAM or Cognito User Pools

### CORS
Enable CORS with appropriate origins

### Method Request
- Authorization: Cognito User Pool Authorizer
- Request Validator: Validate query string parameters

### Integration Request
- Integration type: Lambda Function
- Use Lambda Proxy integration: Yes

---

## Environment Variables

Add to Lambda function configuration:
```
BOOKS_TABLE=online-library-books
BOOKS_BUCKET=online-library-books-bucket
ADMIN_EMAILS=nhanle221199@gmail.com
```

---

## Testing

### Test Command (curl)
```bash
curl -X GET \
  'https://api.yourdomain.com/admin/books/abc-123-uuid/preview-url?responseContentDisposition=inline' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Expected Response
```json
{
  "url": "https://s3.amazonaws.com/bucket/key?signed-params...",
  "title": "Test Book",
  "author": "Test Author",
  "description": "Test description",
  "uploadDate": "2025-12-02T10:00:00Z",
  "pages": 100,
  "status": "PENDING"
}
```

---

## Security Considerations

1. **Admin-Only Access**: Strictly enforce admin authorization
2. **Signed URLs**: Use short expiration (1 hour recommended)
3. **Status Bypass**: This endpoint intentionally bypasses status checks - ensure proper admin verification
4. **Audit Logging**: Log all admin preview requests for security audits
5. **Rate Limiting**: Consider rate limiting to prevent abuse

---

## Frontend Integration

The frontend is already configured to use this endpoint:

**File**: `lib/api.js`
```javascript
getAdminPreviewUrl: async (bookId, params = {}) => {
  const response = await apiClient.get(API_ENDPOINTS.ADMIN_PREVIEW_URL(bookId), { params });
  return response.data;
}
```

**File**: `lib/constants.js`
```javascript
ADMIN_PREVIEW_URL: (bookId) => `/admin/books/${bookId}/preview-url`
```

**Usage in**: `pages/read/[bookId].js`
- Automatically detects if user is admin
- Uses admin preview URL for pending books
- Falls back to regular read URL if admin endpoint fails

---

## Deployment Checklist

- [ ] Create Lambda function with handler code
- [ ] Set environment variables (BOOKS_TABLE, BOOKS_BUCKET, ADMIN_EMAILS)
- [ ] Configure IAM role with DynamoDB read and S3 GetObject permissions
- [ ] Create API Gateway endpoint `/admin/books/{bookId}/preview-url`
- [ ] Configure Cognito authorizer
- [ ] Enable CORS
- [ ] Deploy and test with Postman/curl
- [ ] Test from admin dashboard in frontend
- [ ] Monitor CloudWatch logs for errors
- [ ] Update API documentation

---

## Related Endpoints

- `GET /books/{bookId}/read-url` - Regular read URL (approved books only)
- `GET /admin/books/pending` - List pending books
- `POST /admin/books/{bookId}/approve` - Approve book
- `POST /admin/books/{bookId}/reject` - Reject book

---

## Notes

- This endpoint is critical for the admin workflow
- Without it, admins cannot preview books before approval
- Frontend already has fallback logic in place
- Backend implementation is the final step to enable this feature

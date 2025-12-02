# Fix: Books Downloading Instead of Viewing Inline

## Problem
When users click "Đọc sách" (Read Book), the PDF immediately downloads to their device instead of displaying inline in the browser for preview.

## Root Cause
The backend `/books/{bookId}/read-url` endpoint is generating S3/CloudFront signed URLs with `Content-Disposition: attachment` header, which forces the browser to download the file instead of displaying it.

The frontend is correctly sending `responseContentDisposition=inline` as a query parameter, but the backend is not respecting this parameter.

## Solution

### Backend Changes Required

#### 1. Update Lambda Handler to Accept Query Parameter

**File:** `BACKEND/lambda/get_read_url/handler.py`

Add support for the `responseContentDisposition` query parameter:

```python
import json
import boto3
import os
from botocore.client import Config

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['BOOKS_TABLE'])

# S3 client for generating signed URLs
s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))

def lambda_handler(event, context):
    try:
        # Get bookId from path
        book_id = event['pathParameters']['bookId']
        
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        content_disposition = query_params.get('responseContentDisposition', 'inline')
        
        # Validate content_disposition
        if content_disposition not in ['inline', 'attachment']:
            content_disposition = 'inline'
        
        # Get book from DynamoDB
        response = table.get_item(Key={'bookId': book_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Book not found'})
            }
        
        book = response['Item']
        
        # Check if approved
        if book.get('status') != 'APPROVED':
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Book not approved'})
            }
        
        s3_key = book.get('s3Key')
        s3_bucket = os.environ.get('BOOKS_BUCKET')
        
        if not s3_key or not s3_bucket:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Book storage information missing'})
            }
        
        # Generate signed URL with Content-Disposition header
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_bucket,
                'Key': s3_key,
                'ResponseContentDisposition': content_disposition,
                'ResponseContentType': 'application/pdf'
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'url': signed_url,
                'readUrl': signed_url,  # Backward compatibility
                'title': book.get('title', 'Unknown'),
                'author': book.get('author', 'Unknown'),
                'description': book.get('description', ''),
                'uploadDate': book.get('createdAt', ''),
                'pages': book.get('pages'),
                'expiresIn': 3600
            })
        }
        
    except Exception as e:
        print(f'Error generating read URL: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
```

#### 2. Update CloudFront Configuration (If Using CloudFront)

If you're using CloudFront instead of direct S3 URLs:

**Option A: Use S3 Pre-signed URLs with CloudFront**
- CloudFront can forward query string parameters
- Add `ResponseContentDisposition` to the CloudFront cache key policy
- This allows the S3 signed URL parameters to work through CloudFront

**Option B: Use CloudFront Signed URLs with Custom Headers**
- Generate CloudFront signed URLs
- Include `Content-Disposition` in the URL parameters
- Configure CloudFront to forward the `Content-Disposition` header from origin

**CloudFront Cache Behavior Settings:**
```
Cache key and origin requests:
  - Query strings: Include specified query strings
  - Query string whitelist: ResponseContentDisposition, ResponseContentType
  
Origin request policy:
  - Headers: Include whitelisted headers
  - Header whitelist: Content-Disposition
```

#### 3. Update API Gateway

Ensure API Gateway is configured to pass query string parameters:

```yaml
# serverless.yml or SAM template
/books/{bookId}/read-url:
  get:
    parameters:
      - name: responseContentDisposition
        in: query
        required: false
        schema:
          type: string
          enum: [inline, attachment]
          default: inline
    x-amazon-apigateway-integration:
      requestParameters:
        integration.request.querystring.responseContentDisposition: method.request.querystring.responseContentDisposition
```

---

## Testing

### Test Inline (View in Browser)
```bash
# Should open PDF in browser
curl -X GET \
  'https://your-api.com/books/{bookId}/read-url?responseContentDisposition=inline' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

Expected response:
```json
{
  "url": "https://s3.amazonaws.com/bucket/key?responseContentDisposition=inline&...",
  "title": "Book Title",
  "author": "Author Name"
}
```

When you open this URL in browser, it should display the PDF inline.

### Test Attachment (Download)
```bash
# Should download file
curl -X GET \
  'https://your-api.com/books/{bookId}/read-url?responseContentDisposition=attachment' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

When you open this URL in browser, it should trigger a download.

---

## Frontend Verification

The frontend is already correctly configured:

**Preview/View (inline):**
```javascript
// pages/read/[bookId].js
const result = await api.getReadUrl(bookId, { 
  responseContentDisposition: 'inline'  // ✅ Correct
});
```

**Download:**
```javascript
// pages/read/[bookId].js - handleDownload()
const result = await api.getReadUrl(bookId, { 
  responseContentDisposition: 'attachment'  // ✅ Correct
});
```

---

## Alternative Quick Fix (Backend)

If you can't modify the Lambda immediately, you can set a default at the S3 bucket level:

### S3 Bucket CORS Configuration
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "ExposeHeaders": ["Content-Disposition"],
    "MaxAgeSeconds": 3000
  }
]
```

### S3 Bucket Metadata Defaults
Set metadata on uploaded files:
```python
# When uploading to S3
s3_client.put_object(
    Bucket=bucket_name,
    Key=s3_key,
    Body=file_content,
    ContentType='application/pdf',
    ContentDisposition='inline',  # Default to inline
    Metadata={
        'original-name': file_name
    }
)
```

But this won't allow dynamic switching - you'd need the Lambda change for full functionality.

---

## Deployment Steps

1. Update Lambda handler code with query parameter support
2. Update IAM role to ensure S3 GetObject permissions
3. Test Lambda with both `inline` and `attachment` parameters
4. Deploy to staging environment first
5. Test from frontend (click "Đọc sách" should preview, click "Tải xuống" should download)
6. Deploy to production

---

## Verification Checklist

- [ ] Backend accepts `responseContentDisposition` query parameter
- [ ] Backend generates S3 signed URLs with correct `ResponseContentDisposition`
- [ ] API Gateway forwards query string parameters
- [ ] CloudFront (if used) forwards query strings and headers
- [ ] Frontend sends `inline` for preview
- [ ] Frontend sends `attachment` for download
- [ ] PDF displays in browser when clicking "Đọc sách"
- [ ] PDF downloads when clicking "Tải xuống" button
- [ ] Signed URLs expire after 1 hour
- [ ] CORS headers are properly set

---

## Common Issues

### Issue 1: Still Downloads Despite `inline`
**Cause:** Browser treating all PDFs as downloads
**Fix:** Ensure `Content-Type: application/pdf` is set in S3 signed URL parameters

### Issue 2: Query Parameter Not Reaching Lambda
**Cause:** API Gateway not forwarding query strings
**Fix:** Update API Gateway integration to map query parameters

### Issue 3: CloudFront Caching Wrong Version
**Cause:** CloudFront cache not considering query string
**Fix:** Update CloudFront cache behavior to include query strings in cache key

### Issue 4: CORS Error
**Cause:** S3/CloudFront not allowing cross-origin requests
**Fix:** Update CORS configuration on S3 bucket and CloudFront

---

## Contact

If issues persist after implementing these changes, check:
1. CloudWatch logs for Lambda errors
2. Browser Network tab for actual URL generated
3. S3 bucket permissions and CORS
4. CloudFront cache behavior settings

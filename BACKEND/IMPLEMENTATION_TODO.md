# Backend Implementation TODO

## Current Status

✅ **Implemented:**
- `createUploadUrl` Lambda - Generates presigned S3 URLs for uploads

❌ **Not Implemented (causing CORS errors):**
- `searchBooks` Lambda - Search books by title or author
- `getReadUrl` Lambda - Get CloudFront signed URL for reading
- `getMyUploads` Lambda - Get user's uploaded books
- `listPendingBooks` Lambda - Admin: list pending approvals
- `approveBook` Lambda - Admin: approve a book
- `rejectBook` Lambda - Admin: reject a book

## Frontend Behavior

The frontend now gracefully handles missing backend endpoints:

1. **Books Page (`/books`):**
   - Tries to call `GET /books/search`
   - On CORS/404 error: Shows mock data with warning banner
   - Mock books have IDs starting with `mock-`

2. **Read Button:**
   - Checks if `bookId` starts with `mock-`
   - If mock: Shows warning message
   - If real: Tries to call `GET /books/{bookId}/read-url`

## Implementation Priority

### High Priority (Needed for MVP)

1. **searchBooks Lambda**
   - Endpoint: `GET /books/search?title=...&author=...&page=1&pageSize=20`
   - Query DynamoDB GSI by title or author
   - Return approved books only
   - Required for users to discover books

2. **getReadUrl Lambda**
   - Endpoint: `GET /books/{bookId}/read-url`
   - Check book status = APPROVED
   - Generate CloudFront signed URL (1 hour expiry)
   - Required for users to read books

### Medium Priority

3. **getMyUploads Lambda**
   - Endpoint: `GET /books/my-uploads?page=1&pageSize=20`
   - Query DynamoDB by userId (from JWT)
   - Return all user's uploads with status
   - Required for "My Uploads" page

4. **listPendingBooks Lambda**
   - Endpoint: `GET /admin/books/pending?page=1&pageSize=20`
   - Require admin role in JWT
   - Query DynamoDB for status = PENDING
   - Required for admin approval workflow

### Lower Priority

5. **approveBook Lambda**
   - Endpoint: `POST /admin/books/{bookId}/approve`
   - Copy file from temp to public folder in S3
   - Update DynamoDB status to APPROVED
   - Send notification (optional)

6. **rejectBook Lambda**
   - Endpoint: `POST /admin/books/{bookId}/reject`
   - Update DynamoDB status to REJECTED
   - Include rejection reason
   - Send notification (optional)

## Lambda Implementation Steps

### 1. searchBooks Lambda

**Create:** `BACKEND/lambda/search_books/handler.py`

```python
import json
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['BOOKS_TABLE'])

def lambda_handler(event, context):
    # Parse query parameters
    params = event.get('queryStringParameters', {})
    title = params.get('title')
    author = params.get('author')
    page = int(params.get('page', 1))
    page_size = int(params.get('pageSize', 20))
    
    # Query DynamoDB
    if title:
        response = table.query(
            IndexName='TitleIndex',
            KeyConditionExpression=Key('title').eq(title),
            FilterExpression=Attr('status').eq('APPROVED')
        )
    elif author:
        response = table.query(
            IndexName='AuthorIndex',
            KeyConditionExpression=Key('author').eq(author),
            FilterExpression=Attr('status').eq('APPROVED')
        )
    else:
        # Get all approved books
        response = table.scan(
            FilterExpression=Attr('status').eq('APPROVED')
        )
    
    items = response.get('Items', [])
    
    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = items[start:end]
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps({
            'data': paginated_items,
            'meta': {
                'total': len(items),
                'page': page,
                'pageSize': page_size
            }
        })
    }
```

**Environment Variables:**
- `BOOKS_TABLE` - DynamoDB table name

**IAM Permissions:**
- `dynamodb:Query`
- `dynamodb:Scan`

### 2. getReadUrl Lambda

**Create:** `BACKEND/lambda/get_read_url/handler.py`

```python
import json
import boto3
import os
from datetime import datetime, timedelta
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import rsa

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['BOOKS_TABLE'])
ssm = boto3.client('ssm')

def lambda_handler(event, context):
    # Get bookId from path
    book_id = event['pathParameters']['bookId']
    
    # Get book from DynamoDB
    response = table.get_item(Key={'bookId': book_id})
    
    if 'Item' not in response:
        return {
            'statusCode': 404,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Book not found'})
        }
    
    book = response['Item']
    
    # Check if approved
    if book.get('status') != 'APPROVED':
        return {
            'statusCode': 403,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Book not approved'})
        }
    
    # Generate CloudFront signed URL
    cloudfront_domain = os.environ['CLOUDFRONT_DOMAIN']
    key_pair_id = os.environ['CLOUDFRONT_KEY_PAIR_ID']
    
    # Get private key from Parameter Store
    private_key_param = ssm.get_parameter(
        Name=os.environ['CLOUDFRONT_PRIVATE_KEY_PARAM'],
        WithDecryption=True
    )
    private_key = private_key_param['Parameter']['Value']
    
    # Create signed URL
    expires = datetime.utcnow() + timedelta(hours=1)
    url = f"https://{cloudfront_domain}/{book['s3Key']}"
    
    # Use CloudFront signer (simplified - use proper library in production)
    signed_url = create_signed_url(url, private_key, key_pair_id, expires)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'readUrl': signed_url,
            'expiresIn': 3600
        })
    }
```

**Environment Variables:**
- `BOOKS_TABLE` - DynamoDB table name
- `CLOUDFRONT_DOMAIN` - CloudFront distribution domain
- `CLOUDFRONT_KEY_PAIR_ID` - CloudFront key pair ID
- `CLOUDFRONT_PRIVATE_KEY_PARAM` - SSM parameter with private key

**IAM Permissions:**
- `dynamodb:GetItem`
- `ssm:GetParameter`

## CDK Deployment

Add these Lambdas to your CDK stack:

```python
# Search Books Lambda
search_books_lambda = _lambda.Function(
    self, "SearchBooksFunction",
    runtime=_lambda.Runtime.PYTHON_3_11,
    handler="handler.lambda_handler",
    code=_lambda.Code.from_asset("lambda/search_books"),
    environment={
        "BOOKS_TABLE": books_table.table_name
    }
)

books_table.grant_read_data(search_books_lambda)

# Add to API Gateway
api.add_routes(
    path="/books/search",
    methods=[apigwv2.HttpMethod.GET],
    integration=apigwv2_integrations.HttpLambdaIntegration(
        "SearchBooksIntegration",
        search_books_lambda
    )
)
```

## Testing

Once deployed, test with:

```bash
# Search by title
curl -H "Authorization: Bearer $TOKEN" \
  "https://jjn2ygekea.execute-api.ap-southeast-1.amazonaws.com/books/search?title=AWS"

# Get read URL
curl -H "Authorization: Bearer $TOKEN" \
  "https://jjn2ygekea.execute-api.ap-southeast-1.amazonaws.com/books/abc123/read-url"
```

## Frontend Integration

Once backend is deployed:
1. Refresh the books page
2. Should load real data from DynamoDB
3. Warning banner disappears
4. Read button works and opens CloudFront signed URL

## Notes

- All Lambda functions MUST include CORS headers
- All endpoints require JWT validation (except OPTIONS)
- Use environment variables for configuration
- Log errors to CloudWatch for debugging
- Consider adding caching for frequently accessed books

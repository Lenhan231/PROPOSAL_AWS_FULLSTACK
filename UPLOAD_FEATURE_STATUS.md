# Upload Feature - Issues & Solutions Summary

## Current Status: ❌ Not Working

### Issues Found:

1. **API Gateway returns 500 Internal Server Error**
   - Endpoint: `https://apksz2vpb2.execute-api.ap-southeast-1.amazonaws.com/books/upload-url`
   - Error: `{"message":"Internal Server Error"}`
   - Root Cause: Lambda function is either:
     - Not deployed
     - Not connected to the API Gateway route
     - Missing environment variable `UPLOAD_BUCKET` or `BUCKET_NAME`
     - Has runtime errors

2. **Frontend receives Network Error**
   - Because the API returns 500, CORS headers may not be set
   - Enhanced error logging added to `src/services/api.js`

3. **Invalid Link Error (FIXED ✅)**
   - `pages/404.js` - removed nested `<a>` tag inside `<Link>`

---

## Required Actions to Fix:

### 1. Deploy the Lambda Function

You need to deploy the Lambda function you created at:
`BACKEND/lambda/create_upload_url/handler.py`

#### Option A: Manual deployment via AWS Console
1. Go to AWS Lambda Console
2. Create a new function named `CreateUploadUrlFn`
3. Upload the `handler.py` code
4. Set Runtime: Python 3.12
5. Add Environment Variables:
   - `UPLOAD_BUCKET` = `onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t`
   - `UPLOAD_PREFIX` = `uploads` (optional)
6. Add IAM permissions to generate presigned URLs:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:PutObjectAcl"
         ],
         "Resource": "arn:aws:s3:::onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t/*"
       }
     ]
   }
   ```

#### Option B: Deploy via CDK (Recommended)

If you have a CDK stack, you need to:

1. **Create or update your CDK stack** (e.g., `backend_stack.py`):

```python
from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_apigatewayv2 as apigw,
    aws_apigatewayv2_integrations as integrations,
    aws_s3 as s3,
    Duration,
    CfnOutput
)
from constructs import Construct

class BackendStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Reference existing S3 bucket
        bucket = s3.Bucket.from_bucket_name(
            self,
            "UploadBucket",
            "onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t"
        )

        # Lambda function
        create_upload_fn = _lambda.Function(
            self,
            "CreateUploadUrlFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("lambda/create_upload_url"),
            environment={
                'UPLOAD_BUCKET': bucket.bucket_name,
                'UPLOAD_PREFIX': 'uploads'
            }
        )

        # Grant Lambda permission to generate presigned URLs
        bucket.grant_put(create_upload_fn)

        # HTTP API with CORS
        http_api = apigw.HttpApi(
            self,
            "OnlineLibraryHttpApi",
            api_name="OnlineLibraryApi",
            cors_preflight=apigw.CorsPreflightOptions(
                allow_methods=[
                    apigw.CorsHttpMethod.GET,
                    apigw.CorsHttpMethod.POST,
                    apigw.CorsHttpMethod.OPTIONS
                ],
                allow_origins=['http://localhost:3000', 'http://localhost:3001'],
                allow_headers=['Content-Type', 'Authorization'],
                max_age=Duration.hours(1)
            )
        )

        # Route: POST /books/upload-url → Lambda
        http_api.add_routes(
            path="/books/upload-url",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration(
                "CreateUploadUrlIntegration",
                handler=create_upload_fn,
            ),
        )

        # Output
        CfnOutput(
            self,
            "HttpApiUrl",
            value=http_api.api_endpoint,
            description="Base URL for HTTP API",
        )
```

2. **Deploy**:
```bash
cd BACKEND
cdk deploy
```

### 2. Update API Gateway Route (if using existing API)

If the API Gateway already exists but the route isn't connected:
1. Go to API Gateway Console
2. Find your API: `OnlineLibraryApi`
3. Create/update route:
   - Method: `POST`
   - Path: `/books/upload-url`
   - Integration: Your Lambda function
4. Deploy the API

### 3. Test After Deployment

```bash
# Test the endpoint
curl -i -X POST https://apksz2vpb2.execute-api.ap-southeast-1.amazonaws.com/books/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Book",
    "author": "Test Author",
    "fileName": "test.pdf",
    "fileSize": 1024,
    "contentType": "application/pdf"
  }'
```

Expected response (200 OK):
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "objectKey": "uploads/uuid-test.pdf"
}
```

### 4. Verify Frontend Works

Once the API is working:
1. Restart your Next.js dev server (if needed)
2. Go to http://localhost:3000/upload
3. Fill in the form and select a file
4. Click "Tải lên"
5. Check browser console for logs:
   - "📤 Requesting upload URL"
   - "✅ Upload URL received"

---

## Files Modified:

✅ `src/services/api.js` - Added error handling and logging  
✅ `pages/404.js` - Fixed Link component  
✅ `BACKEND/lambda/create_upload_url/handler.py` - Created Lambda handler  
✅ `.env.local` - Has `NEXT_PUBLIC_API_BASE_URL` configured  

---

## Next Steps:

1. **Priority 1**: Deploy the Lambda function (see options above)
2. **Priority 2**: Connect Lambda to API Gateway route
3. **Priority 3**: Test end-to-end upload flow
4. **Optional**: Add metadata persistence to DynamoDB after upload

---

## Temporary Workaround (for testing frontend only):

If you can't deploy the Lambda immediately, create a mock API endpoint:

Create `pages/api/upload-url.js`:
```javascript
export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Return a fake presigned URL for testing
    res.status(200).json({
      uploadUrl: 'https://httpbin.org/put',
      objectKey: `uploads/${Date.now()}-${req.body.fileName}`
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
```

Then update `.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

This will let you test the frontend UI flow without the real backend.

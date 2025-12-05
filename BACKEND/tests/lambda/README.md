# Lambda Tests

Comprehensive test suite for Lambda functions with mocked AWS services.

## Test Infrastructure

### Fixtures (conftest.py)

#### AWS Service Mocks
- `aws_region` - Default AWS region (ap-southeast-1)
- `moto_backend` - Shared moto mock context for all AWS services
- `s3_bucket` - Mocked S3 bucket with prefixes (uploads/, public/books/, quarantine/)
- `books_table` - Mocked DynamoDB table with all GSIs
- `cloudwatch_logs` - Mocked CloudWatch Logs for structured logging
- `cloudfront_signer` - Mock CloudFront signer for signed URLs

#### Helper Functions

**JWT & API Gateway:**
```python
# Build JWT claims
claims = build_jwt_claims(
    user_id="user-123",
    email="user@example.com",
    groups=["Admins"]  # Optional
)

# Build complete API Gateway event
event = build_api_gateway_event(
    method="POST",
    path="/books/upload-url",
    body={"fileName": "book.pdf", "fileSize": 1024},
    user_id="user-123",
    email="user@example.com",
    groups=["Admins"]  # Optional
)
```

**DynamoDB:**
```python
# Create draft book item for testing
item = put_draft_book_item_for_test(
    table=books_table,
    book_id="book-123",
    file_name="book.pdf",
    file_size=1024,
    title="Test Book",
    author="Test Author",
    user_id="user-123",
    user_email="user@example.com",
    description="Optional description",
    s3_key="uploads/book-123/book.pdf"
)
```

**CloudFront:**
```python
# Generate mock signed URL
url = generate_mock_cloudfront_signed_url(
    cloudfront_domain="d123456.cloudfront.net",
    s3_key="public/books/test.pdf",
    expires_in_hours=1
)
```

**CloudWatch Logs:**
```python
# Get all logs from a log group
logs = get_cloudwatch_logs(logs_client, "/aws/lambda/test")

# Verify structured log contains expected fields
is_valid = verify_structured_log(
    log_message='{"action": "UPLOAD", "status": "SUCCESS"}',
    expected_fields={"action": "UPLOAD", "status": "SUCCESS"}
)
```

## Test Files

### create_upload_url/

#### test_create_upload_url.py
Basic happy path test for upload URL creation:
- ✅ Creates presigned S3 PUT URL
- ✅ Creates draft book item in DynamoDB
- ✅ Returns correct response format

#### test_create_upload_url_extended.py
Extended tests with error scenarios:
- ✅ File size validation (413 Payload Too Large)
- ✅ File extension validation (415 Unsupported Media Type)
- ✅ Authentication validation (401 Unauthorized)
- ✅ Required fields validation (400 Bad Request)
- ✅ Structured logging verification

## Running Tests

```bash
# Run all tests
pytest BACKEND/tests/lambda/

# Run specific test file
pytest BACKEND/tests/lambda/create_upload_url/test_create_upload_url.py

# Run with verbose output
pytest -v BACKEND/tests/lambda/

# Run with coverage
pytest --cov=BACKEND/lambda BACKEND/tests/lambda/

# Run specific test
pytest BACKEND/tests/lambda/create_upload_url/test_create_upload_url.py::test_create_upload_url_happy_path
```

## Test Patterns

### Testing Lambda with Authentication
```python
def test_admin_endpoint(upload_test_context, build_api_gateway_event):
    event = build_api_gateway_event(
        method="POST",
        path="/admin/books/123/approve",
        body={"reason": "Approved"},
        user_id="admin-1",
        email="admin@example.com",
        groups=["Admins"],  # Admin group
    )
    
    response = handler(event, context=mock_context)
    assert response["statusCode"] == 200
```

### Testing Error Responses
```python
def test_invalid_input(upload_test_context, build_api_gateway_event):
    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={"fileName": "test.pdf"},  # Missing required fields
    )
    
    response = handler(event, context=mock_context)
    assert response["statusCode"] == 400
    
    body = json.loads(response["body"])
    assert body["code"] == "INVALID_REQUEST"
    assert "requestId" in body
    assert "timestamp" in body
```

### Testing DynamoDB Operations
```python
def test_database_state(upload_test_context):
    # Create item
    item = put_draft_book_item_for_test(
        table=books_table,
        book_id="book-123",
        ...
    )
    
    # Verify item exists
    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)
    
    result = table.get_item(
        Key={"PK": f"BOOK#{item['bookId']}", "SK": "METADATA"}
    )
    
    assert result["Item"]["status"] == "UPLOADING"
```

## Mocking Strategy

### What's Mocked
- ✅ S3 (uploads, public/books, quarantine)
- ✅ DynamoDB (table + all GSIs)
- ✅ CloudWatch Logs
- ✅ JWT claims (via API Gateway event)
- ✅ CloudFront signed URLs (mock generation)

### What's NOT Mocked
- ❌ Cognito service (not needed - JWT claims are mocked)
- ❌ Lambda runtime (tests call handler directly)
- ❌ API Gateway routing (tests build events directly)

## Best Practices

1. **Use fixtures** - Reuse `upload_test_context` instead of creating new mocks
2. **Build events** - Use `build_api_gateway_event()` for consistency
3. **Verify responses** - Check both status code and response body structure
4. **Test errors** - Include error scenarios and edge cases
5. **Use helpers** - Leverage `put_draft_book_item_for_test()` for setup
6. **Structured logs** - Use `verify_structured_log()` to validate logging

## Troubleshooting

### Import Errors
If you get import errors, ensure:
- Tests are run from workspace root: `pytest BACKEND/tests/lambda/`
- Lambda code is in `BACKEND/lambda/`
- Shared utilities are in `BACKEND/lambda/shared/`

### Moto Issues
If moto mocks aren't working:
- Ensure `moto_backend` fixture is used
- Check that AWS region is set correctly
- Verify boto3 clients use the same region

### Context Issues
If Lambda context is missing attributes:
- Use `type("Context", (), {"request_id": "req-123"})()` to create mock context
- Or use `MagicMock()` for more flexibility

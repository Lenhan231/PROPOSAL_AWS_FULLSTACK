# Lambda Testing Guide - CDN & Monitoring

## Overview

Complete testing infrastructure for Lambda functions with mocked AWS services including CloudFront (CDN) and CloudWatch (Monitoring).

## What's Included

### 1. CloudFront (CDN) Mocking

**Mock Signed URL Generation:**
```python
# In conftest.py
@pytest.fixture
def cloudfront_signer():
    """Mock CloudFront signer for generating signed URLs."""
    mock_signer = MagicMock()
    mock_signer.generate_signed_url = lambda url, date_less_than, private_key_string, key_pair_id: \
        f"{url}?Signature=mock-signature&Key-Pair-Id={key_pair_id}&Policy=mock-policy"
    return mock_signer

# Helper function
def generate_mock_cloudfront_signed_url(
    cloudfront_domain: str = "d123456.cloudfront.net",
    s3_key: str = "public/books/test.pdf",
    expires_in_hours: int = 1,
) -> str:
    """Generate mock CloudFront signed URL for testing."""
```

**Usage in Tests:**
```python
def test_get_read_url(upload_test_context, cloudfront_signer):
    # Generate mock signed URL
    signed_url = generate_mock_cloudfront_signed_url(
        cloudfront_domain="d123456.cloudfront.net",
        s3_key="public/books/book-123.pdf",
        expires_in_hours=1
    )
    
    assert "Signature=mock-signature" in signed_url
    assert "Key-Pair-Id=APKAJTEST" in signed_url
```

### 2. CloudWatch Logs (Monitoring) Mocking

**CloudWatch Logs Fixture:**
```python
@pytest.fixture
def cloudwatch_logs(moto_backend, aws_region):
    """Create CloudWatch Logs client for testing structured logging."""
    logs_client = boto3.client("logs", region_name=aws_region)
    log_group_name = "/aws/lambda/test"
    logs_client.create_log_group(logGroupName=log_group_name)
    
    return {
        "client": logs_client,
        "log_group_name": log_group_name,
        "region": aws_region,
    }
```

**Helper Functions:**
```python
# Get all logs from a log group
logs = get_cloudwatch_logs(logs_client, "/aws/lambda/test")

# Verify structured log contains expected fields
is_valid = verify_structured_log(
    log_message='{"action": "UPLOAD", "status": "SUCCESS"}',
    expected_fields={"action": "UPLOAD", "status": "SUCCESS"}
)
```

**Usage in Tests:**
```python
def test_create_upload_url_with_logging(upload_test_context_extended):
    logs_client = upload_test_context_extended["logs_client"]
    log_group_name = upload_test_context_extended["log_group_name"]
    
    # Run Lambda
    response = handler(event, context=mock_context)
    
    # Verify logs
    logs = get_cloudwatch_logs(logs_client, log_group_name)
    
    # Check for structured log with expected fields
    assert any(
        verify_structured_log(
            log["message"],
            {"action": "CREATE_UPLOAD_URL", "status": "SUCCESS"}
        )
        for log in logs
    )
```

## Test Files Structure

```
BACKEND/tests/lambda/
├── conftest.py                          # Shared fixtures & helpers
├── README.md                            # Testing documentation
├── create_upload_url/
│   ├── test_create_upload_url.py        # Basic happy path
│   └── test_create_upload_url_extended.py  # Error scenarios + logging
├── validate_mime_type/
│   └── test_validate_mime_type.py       # (Future)
├── approve_book/
│   └── test_approve_book.py             # (Future)
└── get_read_url/
    └── test_get_read_url.py             # (Future - uses CloudFront)
```

## Fixtures Available

### AWS Service Mocks
| Fixture | Purpose | Services |
|---------|---------|----------|
| `aws_region` | Default region | - |
| `moto_backend` | Shared mock context | S3, DynamoDB, CloudWatch |
| `s3_bucket` | Mocked S3 bucket | S3 |
| `books_table` | Mocked DynamoDB table | DynamoDB |
| `cloudwatch_logs` | Mocked CloudWatch Logs | CloudWatch Logs |
| `cloudfront_signer` | Mock CloudFront signer | CloudFront |

### Helper Functions
| Function | Purpose |
|----------|---------|
| `build_jwt_claims()` | Create JWT claims |
| `build_api_gateway_event()` | Create API Gateway event |
| `generate_mock_cloudfront_signed_url()` | Generate mock signed URL |
| `put_draft_book_item_for_test()` | Create test DynamoDB item |
| `get_cloudwatch_logs()` | Retrieve CloudWatch logs |
| `verify_structured_log()` | Verify log structure |

## Example Test Cases

### Test 1: Happy Path with Logging
```python
def test_create_upload_url_with_logging(upload_test_context_extended, build_api_gateway_event):
    """Test upload URL creation with structured logging."""
    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={
            "fileName": "book.pdf",
            "fileSize": 1024,
            "title": "AWS Guide",
            "author": "John Doe",
        },
        user_id="user-123",
        email="user@example.com",
    )
    
    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "uploadUrl" in body
    assert body["bookId"]
```

### Test 2: Error Handling
```python
def test_create_upload_url_invalid_file_size(upload_test_context_extended, build_api_gateway_event):
    """Test file size validation."""
    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={
            "fileName": "huge.pdf",
            "fileSize": 100 * 1024 * 1024,  # 100MB > 50MB limit
            "title": "Huge Book",
            "author": "John Doe",
        },
    )
    
    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())
    
    assert response["statusCode"] == 413  # Payload Too Large
    body = json.loads(response["body"])
    assert body["code"] == "FILE_TOO_LARGE"
```

### Test 3: CloudFront Signed URL
```python
def test_get_read_url_with_cloudfront(upload_test_context, cloudfront_signer):
    """Test CloudFront signed URL generation."""
    signed_url = generate_mock_cloudfront_signed_url(
        cloudfront_domain="d123456.cloudfront.net",
        s3_key="public/books/book-123.pdf",
        expires_in_hours=1
    )
    
    assert "https://d123456.cloudfront.net" in signed_url
    assert "Signature=mock-signature" in signed_url
    assert "Key-Pair-Id=APKAJTEST" in signed_url
```

## Running Tests

```bash
# All tests
pytest BACKEND/tests/lambda/

# Specific test file
pytest BACKEND/tests/lambda/create_upload_url/test_create_upload_url.py

# Specific test
pytest BACKEND/tests/lambda/create_upload_url/test_create_upload_url.py::test_create_upload_url_happy_path

# With coverage
pytest --cov=BACKEND/lambda BACKEND/tests/lambda/

# Verbose output
pytest -v BACKEND/tests/lambda/

# Show print statements
pytest -s BACKEND/tests/lambda/
```

## Key Features

✅ **CloudFront Mocking** - Generate mock signed URLs for testing read access  
✅ **CloudWatch Mocking** - Capture and verify structured logs  
✅ **JWT Claims** - Mock Cognito JWT claims without Cognito service  
✅ **Error Scenarios** - Test all error codes and HTTP status codes  
✅ **DynamoDB** - Full table with GSIs for testing queries  
✅ **S3** - Mocked bucket with proper prefixes  
✅ **Structured Logging** - JSON format with requestId, userId, action, status  
✅ **Reusable Helpers** - Build events, create items, verify logs  

## Best Practices

1. **Use fixtures** - Don't create new mocks, reuse fixtures
2. **Build events** - Use `build_api_gateway_event()` for consistency
3. **Test errors** - Include error scenarios and edge cases
4. **Verify structure** - Check response format and error codes
5. **Mock appropriately** - Only mock what's needed
6. **Keep tests fast** - Use moto for AWS services, not real AWS

## Troubleshooting

### Issue: Import errors
**Solution:** Run tests from workspace root: `pytest BACKEND/tests/lambda/`

### Issue: Moto not mocking
**Solution:** Ensure `moto_backend` fixture is used and region is consistent

### Issue: Context missing attributes
**Solution:** Use `type("Context", (), {"request_id": "req-123"})()` or `MagicMock()`

### Issue: DynamoDB table not found
**Solution:** Ensure `books_table` fixture is used in test function parameters

## Next Steps

1. Add tests for `validate_mime_type` Lambda
2. Add tests for `approve_book` Lambda with admin authorization
3. Add tests for `get_read_url` Lambda with CloudFront signed URLs
4. Add tests for `search_books` Lambda with GSI queries
5. Add integration tests combining multiple Lambdas

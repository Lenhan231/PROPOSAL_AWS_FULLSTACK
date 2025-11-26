# Shared Lambda Utilities

This directory contains shared utilities used across all Lambda functions to ensure consistency, reduce code duplication, and maintain best practices.

## Modules

### error_handler.py
Provides standardized error handling and API response formatting.

**Key Components:**
- `ErrorCode` enum: Machine-readable error codes (INVALID_REQUEST, UNAUTHORIZED, FORBIDDEN, etc.)
- `ApiError` exception: Custom exception with error code and HTTP status
- `build_error_response()`: Builds standardized error response body with error, code, requestId, timestamp
- `api_response()`: Builds API Gateway HTTP API response format
- `lambda_handler_wrapper`: Decorator for consistent error handling across handlers

**Usage:**
```python
from lambda.shared.error_handler import ApiError, ErrorCode, lambda_handler_wrapper, api_response

@lambda_handler_wrapper
def handler(event, context):
    raise ApiError(
        error_code=ErrorCode.INVALID_REQUEST,
        message="Invalid input"
    )
```

### validators.py
Provides input validation functions for common types and constraints.

**Key Functions:**
- `validate_required_fields()`: Check required fields are present
- `validate_string_field()`: Validate string with min/max length
- `validate_integer_field()`: Validate integer with min/max bounds
- `validate_file_extension()`: Validate file extension against allowed set
- `validate_file_size()`: Validate file size doesn't exceed limit
- `validate_email()`: Validate email format
- `validate_enum_field()`: Validate value is in allowed set
- `sanitize_string()`: Remove control characters and truncate

**Usage:**
```python
from lambda.shared.validators import validate_string_field, validate_file_size

title = validate_string_field(data["title"], "title", min_length=1, max_length=200)
validate_file_size(file_size, max_size_bytes=50*1024*1024)
```

### auth.py
Provides JWT claims extraction and authorization checks.

**Key Functions:**
- `extract_jwt_claims()`: Extract JWT claims from API Gateway event
- `get_user_id()`: Extract user ID (sub claim)
- `get_user_email()`: Extract email from claims
- `is_admin()`: Check if user is in Admins group
- `require_admin()`: Require admin access, raise error if not
- `extract_and_validate_user()`: Extract and validate user info in one call

**Usage:**
```python
from lambda.shared.auth import extract_and_validate_user, require_admin

user_id, user_email = extract_and_validate_user(event)

# For admin-only endpoints
claims = extract_jwt_claims(event)
require_admin(claims)
```

### logger.py
Provides structured JSON logging for CloudWatch.

**Key Components:**
- `JsonFormatter`: Custom formatter that outputs logs as JSON
- `get_logger()`: Get configured logger with JSON formatting
- `log_action()`: Log an action with structured fields

**Usage:**
```python
from lambda.shared.logger import get_logger, log_action

logger = get_logger(__name__)
logger.info("Something happened")

log_action(
    logger,
    action="BOOK_APPROVED",
    status="SUCCESS",
    request_id=context.request_id,
    user_id=user_id,
    book_id=book_id
)
```

### dynamodb.py
Provides common DynamoDB operations for book metadata management.

**Key Functions:**
- `put_draft_book_item()`: Create a draft book item with UPLOADING status and 72h TTL

**Usage:**
```python
from lambda.shared.dynamodb import put_draft_book_item

put_draft_book_item(
    table_name="OnlineLibrary",
    book_id=book_id,
    file_name="document.pdf",
    file_size=1024000,
    title="My Book",
    author="John Doe",
    description="A great book",
    user_id=user_id,
    user_email=user_email,
    s3_key=s3_key
)
```

## Error Response Format

All API errors follow this standardized format:

```json
{
  "error": "Human-friendly error message",
  "code": "MACHINE_READABLE_CODE",
  "requestId": "request-id-for-tracing",
  "timestamp": "2025-11-20T10:30:00.000000+00:00"
}
```

## Testing

Use the test helpers in `BACKEND/tests/lambda/conftest.py`:

```python
from tests.lambda.conftest import put_draft_book_item_for_test

# In your test
item = put_draft_book_item_for_test(
    table=books_table,
    book_id="test-book-123",
    file_name="test.pdf",
    file_size=1024,
    title="Test Book",
    author="Test Author",
    user_id="user-123"
)
```

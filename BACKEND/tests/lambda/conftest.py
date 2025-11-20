import os
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import boto3
import pytest
from moto import mock_aws

# Aws Mock Stack
@pytest.fixture
def aws_region() -> str:
    """
    Default AWS region for tests.

    Can be overridden via AWS_REGION env if needed.
    """
    return os.getenv("AWS_REGION", "ap-southeast-1")


@pytest.fixture
def moto_backend(aws_region):
    """
    Shared moto backend for all AWS services in a test.
    Ensures S3, DynamoDB, etc. are mocked together.
    """
    with mock_aws():
        yield


@pytest.fixture
def s3_bucket(moto_backend, aws_region) -> Dict[str, Any]:
    """
    Create a test S3 bucket and basic prefixes.
    """
    s3 = boto3.client("s3", region_name=aws_region)
    bucket_name = "test-uploads-bucket"

    if aws_region == "us-east-1":
        s3.create_bucket(Bucket=bucket_name)
    else:
        s3.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": aws_region},
        )

    for prefix in ("uploads/", "public/books/", "quarantine/"):
        s3.put_object(Bucket=bucket_name, Key=prefix)

    return {"client": s3, "bucket_name": bucket_name, "region": aws_region}


@pytest.fixture
def books_table(moto_backend, aws_region):
    """
    Create the OnlineLibrary DynamoDB table with GSIs.
    """
    dynamodb = boto3.client("dynamodb", region_name=aws_region)
    table_name = "OnlineLibrary"

    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
            {"AttributeName": "GSI2PK", "AttributeType": "S"},
            {"AttributeName": "GSI2SK", "AttributeType": "S"},
            {"AttributeName": "GSI3PK", "AttributeType": "S"},
            {"AttributeName": "GSI3SK", "AttributeType": "S"},
            {"AttributeName": "GSI5PK", "AttributeType": "S"},
            {"AttributeName": "GSI5SK", "AttributeType": "S"},
            {"AttributeName": "GSI6PK", "AttributeType": "S"},
            {"AttributeName": "GSI6SK", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
        GlobalSecondaryIndexes=[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI2",
                "KeySchema": [
                    {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI2SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI3",
                "KeySchema": [
                    {"AttributeName": "GSI3PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI3SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI5",
                "KeySchema": [
                    {"AttributeName": "GSI5PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI5SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI6",
                "KeySchema": [
                    {"AttributeName": "GSI6PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI6SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    )

    return boto3.resource("dynamodb", region_name=aws_region).Table(table_name)


@pytest.fixture
def cloudwatch_logs(moto_backend, aws_region):
    """
    Create CloudWatch Logs client for testing structured logging.
    """
    logs_client = boto3.client("logs", region_name=aws_region)
    log_group_name = "/aws/lambda/test"

    logs_client.create_log_group(logGroupName=log_group_name)

    return {
        "client": logs_client,
        "log_group_name": log_group_name,
        "region": aws_region,
    }


@pytest.fixture
def cloudfront_signer():
    """
    Mock CloudFront signer for generating signed URLs.

    Returns a mock that simulates CloudFront signed URL generation.
    """
    mock_signer = MagicMock()

    def generate_signed_url(url, date_less_than, private_key_string, key_pair_id):
        """Mock CloudFront signed URL generation."""
        return f"{url}?Signature=mock-signature&Key-Pair-Id={key_pair_id}&Policy=mock-policy"

    mock_signer.generate_signed_url = generate_signed_url
    return mock_signer

def _set_lambda_common_env(
    monkeypatch: pytest.MonkeyPatch,
    aws_region: str,
    bucket_name: str,
    table_name: str,
) -> None:
    """
    Helper to configure common Lambda environment variables.

    Reuse this helper from other fixtures/tests that need the same
    environment (e.g. validateMimeType, approveBook, getReadUrl).
    """
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("UPLOAD_URL_TTL_SECONDS", "900")
    monkeypatch.setenv("UPLOADS_BUCKET_NAME", bucket_name)
    monkeypatch.setenv("BOOKS_TABLE_NAME", table_name)


def build_jwt_claims(
    user_id: str = "user-123",
    email: str = "user@example.com",
    groups: list = None,
) -> Dict[str, Any]:
    """
    Build JWT claims for testing.

    Args:
        user_id: User ID (sub claim)
        email: User email
        groups: Optional list of groups (e.g., ["Admins"])

    Returns:
        Dictionary with JWT claims
    """
    claims = {
        "sub": user_id,
        "email": email,
    }
    if groups:
        claims["cognito:groups"] = groups
    return claims


def build_api_gateway_event(
    method: str = "POST",
    path: str = "/",
    body: Dict[str, Any] = None,
    user_id: str = "user-123",
    email: str = "user@example.com",
    groups: list = None,
) -> Dict[str, Any]:
    """
    Build a complete API Gateway HTTP API event for testing.

    Args:
        method: HTTP method
        path: Request path
        body: Request body as dictionary
        user_id: User ID for JWT claims
        email: User email for JWT claims
        groups: Optional list of groups for JWT claims

    Returns:
        Complete API Gateway event
    """
    import json

    claims = build_jwt_claims(user_id=user_id, email=email, groups=groups)

    event = {
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
            },
            "authorizer": {
                "jwt": {
                    "claims": claims,
                }
            },
        },
        "rawPath": path,
    }

    if body:
        event["body"] = json.dumps(body)
        event["isBase64Encoded"] = False

    return event


def generate_mock_cloudfront_signed_url(
    cloudfront_domain: str = "d123456.cloudfront.net",
    s3_key: str = "public/books/test.pdf",
    expires_in_hours: int = 1,
) -> str:
    """
    Generate a mock CloudFront signed URL for testing.

    Args:
        cloudfront_domain: CloudFront domain name
        s3_key: S3 object key
        expires_in_hours: URL expiration time in hours

    Returns:
        Mock signed URL
    """
    from datetime import datetime, timedelta, timezone

    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)).isoformat()

    return (
        f"https://{cloudfront_domain}/{s3_key}"
        f"?Signature=mock-signature-{s3_key}"
        f"&Key-Pair-Id=APKAJTEST"
        f"&Policy=mock-policy"
        f"&Expires={expires_at}"
    )


def put_draft_book_item_for_test(
    table,
    book_id: str,
    file_name: str,
    file_size: int,
    title: str,
    author: str,
    user_id: str,
    user_email: str = "test@example.com",
    description: str = None,
    s3_key: str = None,
) -> Dict[str, Any]:
    """
    Helper to create a draft book item in DynamoDB for testing.

    Args:
        table: DynamoDB table resource
        book_id: Unique book ID
        file_name: Original file name
        file_size: File size in bytes
        title: Book title
        author: Book author
        user_id: Uploader user ID
        user_email: Uploader email
        description: Optional book description
        s3_key: Optional S3 key (defaults to uploads/{book_id}/{file_name})

    Returns:
        Dictionary with created item details
    """
    from datetime import datetime, timedelta, timezone

    if s3_key is None:
        s3_key = f"uploads/{book_id}/{file_name}"

    now = datetime.now(timezone.utc)
    ttl_seconds = int((now + timedelta(hours=72)).timestamp())

    item = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": title,
        "author": author,
        "uploaderId": user_id,
        "uploaderEmail": user_email,
        "status": "UPLOADING",
        "fileSize": file_size,
        "s3Key": s3_key,
        "ttl": ttl_seconds,
        "GSI6PK": f"UPLOADER#{user_id}",
        "GSI6SK": f"BOOK#{book_id}",
    }

    if description:
        item["description"] = description

    table.put_item(Item=item)

    return item


def get_cloudwatch_logs(logs_client, log_group_name: str) -> list:
    """
    Retrieve all log events from a CloudWatch log group.

    Args:
        logs_client: CloudWatch Logs client
        log_group_name: Log group name

    Returns:
        List of log events
    """
    try:
        streams = logs_client.describe_log_streams(logGroupName=log_group_name)
        log_events = []

        for stream in streams.get("logStreams", []):
            stream_name = stream["logStreamName"]
            events = logs_client.get_log_events(
                logGroupName=log_group_name,
                logStreamName=stream_name,
            )
            log_events.extend(events.get("events", []))

        return log_events
    except Exception:
        return []


def verify_structured_log(
    log_message: str,
    expected_fields: Dict[str, Any],
) -> bool:
    """
    Verify that a log message contains expected structured fields.

    Args:
        log_message: Log message (should be JSON)
        expected_fields: Dictionary of expected field names and values

    Returns:
        True if all expected fields are present with correct values
    """
    import json

    try:
        log_data = json.loads(log_message)
        for key, value in expected_fields.items():
            if log_data.get(key) != value:
                return False
        return True
    except (json.JSONDecodeError, TypeError):
        return False


# Re-export production DynamoDB utilities for use in tests
# These are the same functions used by Lambda handlers
def get_dynamodb_table_for_test(table_name: str):
    """
    Get DynamoDB table resource for testing.

    This is a wrapper around the production function for convenience.
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from shared.dynamodb import get_dynamodb_table

    return get_dynamodb_table(table_name)


def get_book_item_for_test(table_name: str, book_id: str) -> Dict[str, Any]:
    """
    Get book item from DynamoDB for testing.

    This is a wrapper around the production function for convenience.
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from shared.dynamodb import get_book_item

    return get_book_item(table_name, book_id)




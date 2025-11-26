"""
Extended tests for create_upload_url Lambda with CDN and monitoring.
"""

import json
from unittest.mock import patch

import boto3
import pytest

from create_upload_url.handler import handler


@pytest.fixture
def upload_test_context_extended(monkeypatch, aws_region, s3_bucket, books_table, cloudwatch_logs):
    """
    Extended context for upload tests with CloudWatch logging.
    """
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("UPLOAD_URL_TTL_SECONDS", "900")
    monkeypatch.setenv("UPLOADS_BUCKET_NAME", s3_bucket["bucket_name"])
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)

    return {
        "region": aws_region,
        "bucket_name": s3_bucket["bucket_name"],
        "table_name": books_table.table_name,
        "logs_client": cloudwatch_logs["client"],
        "log_group_name": cloudwatch_logs["log_group_name"],
    }


def test_create_upload_url_with_logging(upload_test_context_extended, build_api_gateway_event):
    """Test that upload URL creation logs structured events."""
    region = upload_test_context_extended["region"]
    table_name = upload_test_context_extended["table_name"]

    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={
            "fileName": "book.pdf",
            "fileSize": 1024,
            "title": "AWS Serverless Guide",
            "author": "John Doe",
            "description": "Test book",
        },
        user_id="user-123",
        email="user@example.com",
    )

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    assert "uploadUrl" in body
    assert body["bookId"]

    # Verify DynamoDB item was created
    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)

    item = table.get_item(
        Key={"PK": f"BOOK#{body['bookId']}", "SK": "METADATA"}
    ).get("Item")

    assert item is not None
    assert item["status"] == "UPLOADING"
    assert item["uploaderId"] == "user-123"


def test_create_upload_url_invalid_file_size(upload_test_context_extended, build_api_gateway_event):
    """Test error handling for file size exceeding limit."""
    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={
            "fileName": "huge.pdf",
            "fileSize": 100 * 1024 * 1024,  # 100MB, exceeds 50MB limit
            "title": "Huge Book",
            "author": "John Doe",
        },
        user_id="user-123",
        email="user@example.com",
    )

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 413  # Payload Too Large
    body = json.loads(response["body"])
    assert body["code"] == "FILE_TOO_LARGE"
    assert "exceeds maximum" in body["error"]


def test_create_upload_url_invalid_extension(upload_test_context_extended, build_api_gateway_event):
    """Test error handling for unsupported file extension."""
    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={
            "fileName": "document.docx",  # Not allowed
            "fileSize": 1024,
            "title": "Word Document",
            "author": "John Doe",
        },
        user_id="user-123",
        email="user@example.com",
    )

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 415  # Unsupported Media Type
    body = json.loads(response["body"])
    assert body["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_create_upload_url_missing_auth(upload_test_context_extended):
    """Test error handling for missing authentication."""
    event = {
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {}  # Empty claims
                }
            }
        },
        "body": json.dumps({
            "fileName": "book.pdf",
            "fileSize": 1024,
            "title": "Test",
            "author": "Author",
        }),
    }

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 401  # Unauthorized
    body = json.loads(response["body"])
    assert body["code"] == "UNAUTHORIZED"


def test_create_upload_url_missing_fields(upload_test_context_extended, build_api_gateway_event):
    """Test error handling for missing required fields."""
    event = build_api_gateway_event(
        method="POST",
        path="/books/upload-url",
        body={
            "fileName": "book.pdf",
            # Missing fileSize, title, author
        },
        user_id="user-123",
        email="user@example.com",
    )

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 400  # Bad Request
    body = json.loads(response["body"])
    assert body["code"] == "INVALID_REQUEST"
    assert "Missing required fields" in body["error"]

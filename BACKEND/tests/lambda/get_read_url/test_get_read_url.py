"""
Tests for get_read_url Lambda function.
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from get_read_url.handler import handler


@pytest.fixture
def read_url_test_context(monkeypatch, aws_region, s3_bucket, books_table):
    """Context for read URL tests with CloudFront config."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)
    monkeypatch.setenv("CLOUDFRONT_DOMAIN", "d123456.cloudfront.net")
    monkeypatch.setenv("CLOUDFRONT_KEY_PAIR_ID", "APKAJTEST")
    monkeypatch.setenv("CLOUDFRONT_PRIVATE_KEY", "test-private-key")
    monkeypatch.setenv("READ_URL_TTL_SECONDS", "3600")

    return {
        "region": aws_region,
        "table_name": books_table.table_name,
    }


def test_get_read_url_happy_path(read_url_test_context, build_api_gateway_event, put_draft_book_item_for_test):
    """Test successful read URL generation for approved book."""
    region = read_url_test_context["region"]
    table_name = read_url_test_context["table_name"]

    # Create approved book in DynamoDB
    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)

    book_id = "book-123"
    s3_key = "public/books/book-123.pdf"

    item = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Test Book",
        "author": "Test Author",
        "status": "APPROVED",
        "s3Key": s3_key,
        "uploaderId": "user-123",
    }
    table.put_item(Item=item)

    # Build event
    event = build_api_gateway_event(
        method="GET",
        path=f"/books/{book_id}/read-url",
        user_id="user-123",
        email="user@example.com",
    )
    event["pathParameters"] = {"bookId": book_id}

    # Call handler
    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    assert "readUrl" in body
    assert body["expiresIn"] == 3600
    assert body["bookId"] == book_id
    assert "d123456.cloudfront.net" in body["readUrl"]



def test_get_read_url_book_not_found(read_url_test_context, build_api_gateway_event):
    """Test error when book doesn't exist."""
    event = build_api_gateway_event(
        method="GET",
        path="/books/nonexistent/read-url",
        user_id="user-123",
        email="user@example.com",
    )
    event["pathParameters"] = {"bookId": "nonexistent"}

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert body["code"] == "NOT_FOUND"


def test_get_read_url_book_not_approved(read_url_test_context, build_api_gateway_event):
    """Test error when book is not approved."""
    region = read_url_test_context["region"]
    table_name = read_url_test_context["table_name"]

    # Create pending book
    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)

    book_id = "book-pending"
    item = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Pending Book",
        "author": "Test Author",
        "status": "PENDING",
        "s3Key": "uploads/book-pending/book.pdf",
        "uploaderId": "user-123",
    }
    table.put_item(Item=item)

    event = build_api_gateway_event(
        method="GET",
        path=f"/books/{book_id}/read-url",
        user_id="user-123",
        email="user@example.com",
    )
    event["pathParameters"] = {"bookId": book_id}

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert body["code"] == "FORBIDDEN"


def test_get_read_url_missing_book_id(read_url_test_context, build_api_gateway_event):
    """Test error when bookId path parameter is missing."""
    event = build_api_gateway_event(
        method="GET",
        path="/books//read-url",
        user_id="user-123",
        email="user@example.com",
    )
    event["pathParameters"] = {}  # Missing bookId

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["code"] == "INVALID_REQUEST"


def test_get_read_url_unauthorized(read_url_test_context):
    """Test error when user is not authenticated."""
    event = {
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {}  # Empty claims
                }
            }
        },
        "pathParameters": {"bookId": "book-123"},
    }

    response = handler(event, context=type("Context", (), {"request_id": "req-123"})())

    assert response["statusCode"] == 401
    body = json.loads(response["body"])
    assert body["code"] == "UNAUTHORIZED"

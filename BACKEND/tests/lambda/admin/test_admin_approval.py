import json
import sys
from pathlib import Path

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from approve_book.handler import handler as approve_handler
from list_pending_books.handler import handler as list_handler


@pytest.fixture
def admin_context(monkeypatch, aws_region, books_table):
    """Setup for admin approval tests."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)
    monkeypatch.setenv("UPLOADS_BUCKET_NAME", "test-bucket")

    return {
        "region": aws_region,
        "table_name": books_table.table_name,
    }


def test_list_pending_books(admin_context, books_table):
    """Test listing pending books."""
    table_name = admin_context["table_name"]
    
    # Create pending books in DynamoDB
    ddb_resource = boto3.resource("dynamodb", region_name=admin_context["region"])
    table = ddb_resource.Table(table_name)
    
    for i in range(3):
        table.put_item(Item={
            "PK": f"BOOK#book-{i}",
            "SK": "METADATA",
            "bookId": f"book-{i}",
            "title": f"Pending Book {i}",
            "author": "Test Author",
            "status": "PENDING",
            "file_path": f"staging/book-{i}/file.pdf",
        })
    
    # List pending books
    event = {
        "queryStringParameters": {
            "limit": "10",
            "offset": "0",
        },
    }
    
    response = list_handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["books"]) == 3
    assert body["pagination"]["total"] == 3


def test_approve_book(admin_context, books_table, monkeypatch):
    """Test approving a book."""
    from unittest.mock import MagicMock
    
    table_name = admin_context["table_name"]
    book_id = "test-book-123"
    
    # Create pending book
    ddb_resource = boto3.resource("dynamodb", region_name=admin_context["region"])
    table = ddb_resource.Table(table_name)
    
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Test Book",
        "author": "Test Author",
        "status": "PENDING",
        "file_path": f"staging/{book_id}/test.pdf",
    })
    
    # Mock S3 operations
    mock_s3 = MagicMock()
    monkeypatch.setattr("approve_book.handler.s3_client", lambda: mock_s3)
    
    # Approve book
    event = {
        "rawPath": f"/admin/books/{book_id}/approve",
        "pathParameters": {
            "bookId": book_id,
        },
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "admin-user-123"
                }
            }
        },
    }
    
    response = approve_handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["action"] == "approve"
    assert body["status"] == "APPROVED"
    
    # Verify DynamoDB updated
    item = table.get_item(Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}).get("Item")
    assert item["status"] == "APPROVED"
    assert "public/books" in item["file_path"]


def test_reject_book(admin_context, books_table, monkeypatch):
    """Test rejecting a book."""
    from unittest.mock import MagicMock
    
    table_name = admin_context["table_name"]
    book_id = "test-book-456"
    
    # Create pending book
    ddb_resource = boto3.resource("dynamodb", region_name=admin_context["region"])
    table = ddb_resource.Table(table_name)
    
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Test Book",
        "author": "Test Author",
        "status": "PENDING",
        "file_path": f"staging/{book_id}/test.pdf",
    })
    
    # Mock S3 operations
    mock_s3 = MagicMock()
    monkeypatch.setattr("approve_book.handler.s3_client", lambda: mock_s3)
    
    # Reject book
    event = {
        "rawPath": f"/admin/books/{book_id}/reject",
        "pathParameters": {
            "bookId": book_id,
        },
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "admin-user-123"
                }
            }
        },
    }
    
    response = approve_handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["action"] == "reject"
    assert body["status"] == "REJECTED"
    
    # Verify DynamoDB updated
    item = table.get_item(Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}).get("Item")
    assert item["status"] == "REJECTED"
    assert "quarantine" in item["file_path"]


def test_approve_non_pending_book(admin_context, books_table):
    """Test error when approving non-pending book."""
    table_name = admin_context["table_name"]
    book_id = "test-book-789"
    
    # Create approved book
    ddb_resource = boto3.resource("dynamodb", region_name=admin_context["region"])
    table = ddb_resource.Table(table_name)
    
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Test Book",
        "author": "Test Author",
        "status": "APPROVED",
        "file_path": f"public/books/{book_id}/test.pdf",
    })
    
    # Try to approve
    event = {
        "rawPath": f"/admin/books/{book_id}/approve",
        "pathParameters": {
            "bookId": book_id,
        },
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "admin-user-123"
                }
            }
        },
    }
    
    response = approve_handler(event, context={})
    
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "PENDING" in body["error"]

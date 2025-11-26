import json
import sys
import base64
from pathlib import Path
from typing import Any, Dict

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from get_read_url.handler import handler


@pytest.fixture
def get_read_url_context(monkeypatch, aws_region, books_table):
    """Setup for getReadUrl tests."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)
    monkeypatch.setenv("CLOUDFRONT_DOMAIN", "d123456.cloudfront.net")
    
    # Generate test CloudFront key pair
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    
    # Encode as base64 for environment variable
    private_key_b64 = base64.b64encode(private_key_pem.encode()).decode()
    
    monkeypatch.setenv("CLOUDFRONT_KEY_PAIR_ID", "APKAJTEST123")
    monkeypatch.setenv("CLOUDFRONT_PRIVATE_KEY", private_key_b64)

    return {
        "region": aws_region,
        "table_name": books_table.table_name,
        "cloudfront_domain": "d123456.cloudfront.net",
    }


def test_get_read_url_approved_book(get_read_url_context, books_table):
    """Test generating read URL for approved book."""
    table_name = get_read_url_context["table_name"]
    book_id = "test-book-123"
    
    # Create approved book in DynamoDB
    ddb_resource = boto3.resource("dynamodb", region_name=get_read_url_context["region"])
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
    
    # Create API Gateway event
    event = {
        "pathParameters": {
            "bookId": book_id,
        },
    }
    
    # Call handler
    response = handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["bookId"] == book_id
    assert "url" in body
    assert body["expiresIn"] == 3600
    
    # Verify URL format
    url = body["url"]
    assert url.startswith("https://d123456.cloudfront.net/public/books/")
    assert "Policy=" in url
    assert "Signature=" in url
    assert "Key-Pair-Id=" in url


def test_get_read_url_not_approved(get_read_url_context, books_table):
    """Test error when book is not approved."""
    table_name = get_read_url_context["table_name"]
    book_id = "test-book-456"
    
    # Create uploading book in DynamoDB
    ddb_resource = boto3.resource("dynamodb", region_name=get_read_url_context["region"])
    table = ddb_resource.Table(table_name)
    
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Test Book",
        "author": "Test Author",
        "status": "UPLOADING",
    })
    
    # Create API Gateway event
    event = {
        "pathParameters": {
            "bookId": book_id,
        },
    }
    
    # Call handler
    response = handler(event, context={})
    
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert "error" in body


def test_get_read_url_not_found(get_read_url_context):
    """Test error when book not found."""
    # Create API Gateway event
    event = {
        "pathParameters": {
            "bookId": "nonexistent-book",
        },
    }
    
    # Call handler
    response = handler(event, context={})
    
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert "error" in body


def test_get_read_url_missing_book_id(get_read_url_context):
    """Test error when bookId is missing."""
    # Create API Gateway event without bookId
    event = {
        "pathParameters": {},
    }
    
    # Call handler
    response = handler(event, context={})
    
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "error" in body

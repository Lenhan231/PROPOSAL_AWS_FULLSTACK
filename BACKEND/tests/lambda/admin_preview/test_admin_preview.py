import base64
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from admin_preview.handler import handler


@pytest.fixture
def admin_preview_context(monkeypatch, aws_region, books_table):
    """Setup environment for admin preview tests with signing keys."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)
    monkeypatch.setenv("CLOUDFRONT_DOMAIN", "d123456.cloudfront.net")

    # Generate a short-lived RSA key pair for CloudFront signing
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

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

    monkeypatch.setenv("CLOUDFRONT_KEY_PAIR_ID", "APKAJTEST123")
    monkeypatch.setenv("CLOUDFRONT_PRIVATE_KEY", base64.b64encode(private_key_pem.encode()).decode())

    return {
        "region": aws_region,
        "table_name": books_table.table_name,
        "cloudfront_domain": "d123456.cloudfront.net",
    }


@pytest.fixture
def admin_preview_unsigned_context(monkeypatch, aws_region, books_table):
    """Environment without signing keys to exercise unsigned URL path."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)
    monkeypatch.setenv("CLOUDFRONT_DOMAIN", "d123456.cloudfront.net")
    monkeypatch.delenv("CLOUDFRONT_KEY_PAIR_ID", raising=False)
    monkeypatch.delenv("CLOUDFRONT_PRIVATE_KEY", raising=False)

    return {
        "region": aws_region,
        "table_name": books_table.table_name,
        "cloudfront_domain": "d123456.cloudfront.net",
    }


def test_admin_preview_signed_url_for_pending_book(admin_preview_context, books_table):
    """Generate a signed URL for a pending book with default response headers."""
    table_name = admin_preview_context["table_name"]
    book_id = "pending-book-123"
    file_name = "sample.pdf"

    ddb = boto3.resource("dynamodb", region_name=admin_preview_context["region"])
    table = ddb.Table(table_name)
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Pending Book",
        "author": "Test Author",
        "status": "PENDING",
        "file_path": f"staging/{book_id}/{file_name}",
        "mime_type": "application/pdf",
    })

    event = {"pathParameters": {"bookId": book_id}}

    response = handler(event, context={})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["bookId"] == book_id

    url = body["url"]
    assert url.startswith(f"https://{admin_preview_context['cloudfront_domain']}/staging/{book_id}/{file_name}")
    assert "Signature=" in url
    assert "Key-Pair-Id=" in url
    assert "Expires=" in url

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    assert qs.get("response-content-disposition") == [f'inline; filename="{file_name}"']
    assert qs.get("response-content-type") == ["application/pdf"]


def test_admin_preview_returns_404_for_non_pending(admin_preview_context, books_table):
    """Return 404 when the book exists but is not pending."""
    table_name = admin_preview_context["table_name"]
    book_id = "approved-book-123"

    ddb = boto3.resource("dynamodb", region_name=admin_preview_context["region"])
    table = ddb.Table(table_name)
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Approved Book",
        "author": "Test Author",
        "status": "APPROVED",
        "file_path": f"public/books/{book_id}/file.pdf",
    })

    response = handler({"pathParameters": {"bookId": book_id}}, context={})

    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert "error" in body


def test_admin_preview_returns_404_when_missing(admin_preview_context):
    """Return 404 when the book does not exist."""
    response = handler({"pathParameters": {"bookId": "missing-book"}}, context={})

    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert "error" in body


def test_admin_preview_missing_book_id(admin_preview_context):
    """Return 400 when bookId is not supplied in the path."""
    response = handler({"pathParameters": {}}, context={})

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "error" in body


def test_admin_preview_unsigned_url_when_no_keys(admin_preview_unsigned_context, books_table):
    """Fallback to unsigned CloudFront URL when signing keys are absent."""
    table_name = admin_preview_unsigned_context["table_name"]
    book_id = "pending-book-unsigned"
    file_name = "draft.pdf"

    ddb = boto3.resource("dynamodb", region_name=admin_preview_unsigned_context["region"])
    table = ddb.Table(table_name)
    table.put_item(Item={
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Pending Book",
        "author": "Test Author",
        "status": "PENDING",
        "file_path": f"staging/{book_id}/{file_name}",
    })

    disposition = f'attachment; filename="{file_name}"'
    event = {
        "pathParameters": {"bookId": book_id},
        "queryStringParameters": {
            "response-content-disposition": disposition,
            "response-content-type": "application/pdf",
        },
    }

    response = handler(event, context={})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])

    url = body["url"]
    assert "Signature=" not in url  # unsigned path
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    assert qs.get("response-content-disposition") == [disposition]
    assert qs.get("response-content-type") == ["application/pdf"]

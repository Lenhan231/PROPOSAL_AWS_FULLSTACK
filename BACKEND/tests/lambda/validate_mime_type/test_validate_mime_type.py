import json
import sys
from pathlib import Path
from typing import Any, Dict

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from validate_mime_type.handler import handler


@pytest.fixture
def validate_test_context(monkeypatch, aws_region, s3_bucket, books_table):
    """Setup for validate_mime_type tests."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)
    monkeypatch.setenv("UPLOADS_BUCKET_NAME", s3_bucket["bucket_name"])
    monkeypatch.setenv("ALLOWED_MIME_TYPES", "application/pdf,application/epub+zip")

    return {
        "region": aws_region,
        "bucket_name": s3_bucket["bucket_name"],
        "table_name": books_table.table_name,
        "s3_client": s3_bucket["client"],
    }


def test_validate_mime_type_pdf_approved(validate_test_context, build_api_gateway_event):
    """Test PDF file is approved and moved to public/books/"""
    region = validate_test_context["region"]
    bucket_name = validate_test_context["bucket_name"]
    table_name = validate_test_context["table_name"]
    s3_client = validate_test_context["s3_client"]

    # Create test PDF content (magic bytes for PDF)
    pdf_content = b"%PDF-1.4\n%test pdf content"
    book_id = "test-book-123"
    file_name = "test.pdf"
    source_key = f"uploads/{book_id}/{file_name}"
    dest_key = f"public/books/{book_id}/{file_name}"

    # Upload test file to S3
    s3_client.put_object(Bucket=bucket_name, Key=source_key, Body=pdf_content)

    # Create S3 event
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": bucket_name},
                    "object": {"key": source_key},
                }
            }
        ]
    }

    # Call handler
    response = handler(event, context={})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["bookId"] == book_id
    assert body["status"] == "APPROVED"
    assert body["mimeType"] == "application/pdf"

    # Verify file moved to public/books/
    objects = s3_client.list_objects_v2(Bucket=bucket_name, Prefix="public/books/")
    assert "Contents" in objects
    assert any(obj["Key"] == dest_key for obj in objects["Contents"])

    # Verify source file deleted
    objects = s3_client.list_objects_v2(Bucket=bucket_name, Prefix="uploads/")
    assert "Contents" not in objects or not any(obj["Key"] == source_key for obj in objects.get("Contents", []))

    # Verify DynamoDB updated
    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)
    item = table.get_item(Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}).get("Item")
    assert item is not None
    assert item["status"] == "APPROVED"
    assert item.get("mime_type") == "application/pdf"


def test_validate_mime_type_invalid_rejected(validate_test_context):
    """Test invalid file is rejected and moved to quarantine/"""
    region = validate_test_context["region"]
    bucket_name = validate_test_context["bucket_name"]
    table_name = validate_test_context["table_name"]
    s3_client = validate_test_context["s3_client"]

    # Create test invalid content (not PDF or EPUB)
    invalid_content = b"This is not a valid PDF or EPUB file"
    book_id = "test-book-456"
    file_name = "invalid.txt"
    source_key = f"uploads/{book_id}/{file_name}"
    dest_key = f"quarantine/{book_id}/{file_name}"

    # Upload test file to S3
    s3_client.put_object(Bucket=bucket_name, Key=source_key, Body=invalid_content)

    # Create S3 event
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": bucket_name},
                    "object": {"key": source_key},
                }
            }
        ]
    }

    # Call handler
    response = handler(event, context={})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["bookId"] == book_id
    assert body["status"] == "REJECTED"

    # Verify file moved to quarantine/
    objects = s3_client.list_objects_v2(Bucket=bucket_name, Prefix="quarantine/")
    assert "Contents" in objects
    assert any(obj["Key"] == dest_key for obj in objects["Contents"])

    # Verify DynamoDB updated
    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)
    item = table.get_item(Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}).get("Item")
    assert item is not None
    assert item["status"] == "REJECTED"

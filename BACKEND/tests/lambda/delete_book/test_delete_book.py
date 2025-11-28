import json
import sys
from pathlib import Path

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from delete_book.handler import handler


def _seed_book(table, book_id, uploader_id, status="APPROVED", file_path=None):
    item = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": "Test",
        "author": "Author",
        "status": status,
        "uploaderId": uploader_id,
        "uploaderEmail": "user@example.com",
        "file_path": file_path,
    }
    table.put_item(Item=item)


def test_delete_book_by_owner(upload_test_context, s3_bucket, books_table):
    region = upload_test_context["region"]
    bucket_name = upload_test_context["bucket_name"]
    table_name = upload_test_context["table_name"]

    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)

    book_id = "book-del-1"
    file_key = f"uploads/{book_id}/book.pdf"

    _seed_book(table, book_id, uploader_id="user-123", status="APPROVED", file_path=file_key)

    s3 = s3_bucket["client"]
    s3.put_object(Bucket=bucket_name, Key=file_key, Body=b"dummy")

    event = {
        "pathParameters": {"bookId": book_id},
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": "user-123",
                        "email": "user@example.com",
                    }
                }
            }
        },
    }

    resp = handler(event, context={})
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "DELETED"

    # Item removed
    item = table.get_item(Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}).get("Item")
    assert item is None

    # File removed
    with pytest.raises(Exception):
        s3.head_object(Bucket=bucket_name, Key=file_key)


def test_delete_book_forbidden(upload_test_context, books_table):
    region = upload_test_context["region"]
    table_name = upload_test_context["table_name"]

    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)

    book_id = "book-del-2"
    _seed_book(table, book_id, uploader_id="owner-1", status="APPROVED")

    event = {
        "pathParameters": {"bookId": book_id},
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": "someone-else",
                        "email": "user@example.com",
                    }
                }
            }
        },
    }

    resp = handler(event, context={})
    assert resp["statusCode"] == 403

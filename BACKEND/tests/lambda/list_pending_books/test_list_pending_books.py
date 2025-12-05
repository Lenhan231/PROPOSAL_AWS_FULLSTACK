import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from list_pending_books.handler import handler


def _put_item(table, book_id, status, uploaded_at, gsi5=False, uploader="user-1"):
    item = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": f"Book {book_id}",
        "author": "Author",
        "status": status,
        "uploadedAt": uploaded_at,
        "uploaderId": uploader,
    }
    if gsi5:
        item["GSI5PK"] = "STATUS#PENDING"
        item["GSI5SK"] = uploaded_at
    table.put_item(Item=item)


def test_list_pending_books_returns_all_pending(aws_region, books_table, monkeypatch):
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)

    ddb = boto3.resource("dynamodb", region_name=aws_region)
    table = ddb.Table(books_table.table_name)

    now = datetime.now(timezone.utc)
    t1 = (now - timedelta(minutes=10)).isoformat()
    t2 = (now - timedelta(minutes=5)).isoformat()

    # Pending items (one uploaded by admin)
    _put_item(table, "book-user", "PENDING", t1, gsi5=True, uploader="user-1")
    _put_item(table, "book-admin", "PENDING", t2, gsi5=True, uploader="admin-1")

    # Non-pending item should be ignored
    _put_item(table, "book-approved", "APPROVED", t2, gsi5=False, uploader="user-1")

    event = {
        "queryStringParameters": {
            "limit": "10",
            "offset": "0",
        }
    }

    resp = handler(event, context={})
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    ids = [b["bookId"] for b in body["books"]]
    assert ids == ["book-admin", "book-user"]  # sorted by uploadedAt desc
    assert body["pagination"]["total"] == 2
    assert all(b.get("status") == "PENDING" for b in body["books"])


def test_includes_legacy_items_without_gsi5(aws_region, books_table, monkeypatch):
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)

    ddb = boto3.resource("dynamodb", region_name=aws_region)
    table = ddb.Table(books_table.table_name)

    now = datetime.now(timezone.utc)
    t1 = (now - timedelta(minutes=20)).isoformat()
    t2 = (now - timedelta(minutes=10)).isoformat()

    # Pending with GSI5
    _put_item(table, "book-gsi", "PENDING", t2, gsi5=True, uploader="user-1")
    # Pending legacy missing GSI5
    _put_item(table, "book-legacy", "PENDING", t1, gsi5=False, uploader="admin-1")

    event = {
        "queryStringParameters": {
            "limit": "10",
            "offset": "0",
        }
    }

    resp = handler(event, context={})
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])

    ids = [b["bookId"] for b in body["books"]]
    # book-gsi newer so first, legacy still included
    assert ids == ["book-gsi", "book-legacy"]
    assert body["pagination"]["total"] == 2
    assert all(b.get("status") == "PENDING" for b in body["books"])

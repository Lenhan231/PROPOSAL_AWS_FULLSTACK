import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from get_my_uploads.handler import handler


def _put_book_item(table, book_id, user_id, status, uploaded_at, extra=None):
    item = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": f"Book {book_id}",
        "author": "Author",
        "status": status,
        "uploadedAt": uploaded_at,
        "createdAt": uploaded_at,
        "uploaderId": user_id,
        "uploaderEmail": f"{user_id}@example.com",
        "GSI6PK": f"UPLOADER#{user_id}",
        "GSI6SK": f"BOOK#{book_id}",
    }
    if extra:
        item.update(extra)
    table.put_item(Item=item)


def test_get_my_uploads_happy_path(upload_test_context, books_table, build_api_gateway_event):
    region = upload_test_context["region"]
    table_name = upload_test_context["table_name"]
    user_id = "user-123"
    other_user_id = "user-999"

    ddb_resource = boto3.resource("dynamodb", region_name=region)
    table = ddb_resource.Table(table_name)

    now = datetime.now(timezone.utc)
    t1 = (now - timedelta(minutes=30)).isoformat()
    t2 = (now - timedelta(minutes=20)).isoformat()
    t3 = (now - timedelta(minutes=10)).isoformat()

    # User's uploads
    _put_book_item(table, "book-old", user_id, "PENDING", t1)
    _put_book_item(table, "book-new", user_id, "APPROVED", t3, extra={"approvedAt": t3})
    _put_book_item(
        table,
        "book-rej",
        user_id,
        "REJECTED",
        t2,
        extra={"rejectedAt": t2, "rejectedReason": "Invalid file"},
    )

    # Another user's upload (should be excluded)
    _put_book_item(table, "book-other", other_user_id, "APPROVED", t2)

    event = build_api_gateway_event(
        method="GET",
        path="/books/my-uploads",
        user_id=user_id,
        email="user@example.com",
    )

    response = handler(event, context={})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])

    books = body["books"]
    # Should return only the 3 uploads of user_id
    assert [b["bookId"] for b in books] == ["book-new", "book-rej", "book-old"]

    # Check fields
    approved = next(b for b in books if b["bookId"] == "book-new")
    rejected = next(b for b in books if b["bookId"] == "book-rej")

    assert approved["status"] == "APPROVED"
    assert approved.get("approvedAt") == t3

    assert rejected["status"] == "REJECTED"
    assert rejected.get("rejectedReason") == "Invalid file"
    assert rejected.get("rejectedAt") == t2

    # Pagination metadata
    assert body["pagination"]["total"] == 3

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from reject_book.handler import handler


def test_reject_book_happy_path(upload_test_context, s3_bucket, books_table):
    region = upload_test_context["region"]
    bucket_name = upload_test_context["bucket_name"]
    table_name = upload_test_context["table_name"]

    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)

    book_id = "book-456"
    s3_key = f"staging/{book_id}/book.pdf"

    # Seed DynamoDB with PENDING item
    table.put_item(
        Item={
            "PK": f"BOOK#{book_id}",
            "SK": "METADATA",
            "bookId": book_id,
            "title": "Test Book",
            "author": "Author",
            "status": "PENDING",
            "uploaderId": "user-123",
            "uploaderEmail": "user@example.com",
            "file_path": s3_key,
            "GSI5PK": "STATUS#PENDING",
            "GSI5SK": datetime.now(timezone.utc).isoformat(),
        }
    )

    # Seed S3 with file in staging/
    s3 = s3_bucket["client"]
    s3.put_object(Bucket=bucket_name, Key=s3_key, Body=b"dummy-pdf-content")

    event = {
        "pathParameters": {
            "bookId": book_id,
        },
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": "admin-1",
                        "email": "admin@example.com",
                        "cognito:groups": ["Admins"],
                    }
                }
            }
        },
        "body": json.dumps(
            {"reason": "Copyright violation"}
        ),
    }

    response = handler(event, context={})

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    assert body["bookId"] == book_id
    assert body["status"] == "REJECTED"
    assert body["reason"] == "Copyright violation"

    # Verify DynamoDB status
    item = table.get_item(
        Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}
    ).get("Item")

    assert item is not None
    assert item["status"] == "REJECTED"
    assert "rejectedAt" in item
    assert item.get("rejectedBy") == "admin-1"
    assert item.get("rejectedReason") == "Copyright violation"
    # GSI5 removed
    assert item.get("GSI5PK") is None
    assert item.get("GSI5SK") is None

    # Verify S3 object moved to quarantine and removed from staging
    s3.head_object(Bucket=bucket_name, Key=f"quarantine/{book_id}/book.pdf")
    with pytest.raises(Exception):
        s3.head_object(Bucket=bucket_name, Key=s3_key)

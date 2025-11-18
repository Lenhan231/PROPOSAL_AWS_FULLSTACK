import json

import boto3
import pytest

from approve_book.handler import handler

from lib.utils.error_codes import ErrorCode


@pytest.mark.skip(reason="TODO: implement approve_book Lambda")
def test_approve_book_happy_path(upload_test_context, s3_bucket, books_table):
    """
    Happy-path test for approveBook:
    - Assume an existing PENDING book item
    - File exists in uploads/
    - After calling handler:
      - status becomes APPROVED
      - file is copied to public/books/ and removed from uploads/
    """
    region = upload_test_context["region"]
    bucket_name = upload_test_context["bucket_name"]
    table_name = upload_test_context["table_name"]

    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)

    book_id = "book-123"
    s3_key = f"uploads/{book_id}/book.pdf"

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
            "s3Key": s3_key,
        }
    )

    # Seed S3 with file in uploads/
    s3 = s3_bucket["client"]
    s3.put_object(Bucket=bucket_name, Key=s3_key, Body=b"dummy-pdf-content")

    event = {
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
        "body": json.dumps({"bookId": book_id}),
    }

    response = handler(event, context={})

    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    assert body["bookId"] == book_id
    assert body["status"] == "APPROVED"

    # Verify DynamoDB status
    item = table.get_item(
        Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"}
    ).get("Item")

    assert item is not None
    assert item["status"] == "APPROVED"
    assert "approvedAt" in item
    assert item.get("approvedBy") == "admin-1"

    # Verify S3 object moved
    public_key = f"public/books/{book_id}/book.pdf"
    s3.head_object(Bucket=bucket_name, Key=public_key)

    with pytest.raises(Exception):
        s3.head_object(Bucket=bucket_name, Key=s3_key)

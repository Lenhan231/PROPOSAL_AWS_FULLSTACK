"""
Shared DynamoDB utilities for Lambda functions.

Provides common DynamoDB operations and client initialization.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import boto3


def get_dynamodb_table(table_name: str):
    """
    Get a DynamoDB table resource with proper region configuration.

    Args:
        table_name: DynamoDB table name

    Returns:
        DynamoDB table resource

    Example:
        table = get_dynamodb_table("OnlineLibrary")
        item = table.get_item(Key={"PK": "BOOK#123", "SK": "METADATA"})
    """
    region = _get_aws_region()
    dynamodb = boto3.resource("dynamodb", region_name=region)
    return dynamodb.Table(table_name)


def get_dynamodb_client(region: Optional[str] = None):
    """
    Get a DynamoDB client with proper region configuration.

    Args:
        region: Optional AWS region (uses env vars if not provided)

    Returns:
        DynamoDB client

    Example:
        client = get_dynamodb_client()
        response = client.query(TableName="OnlineLibrary", ...)
    """
    if not region:
        region = _get_aws_region()
    return boto3.client("dynamodb", region_name=region)


def _get_aws_region() -> str:
    """
    Get AWS region from environment variables.

    Checks in order:
    1. AWS_REGION
    2. AWS_DEFAULT_REGION
    3. Default: ap-southeast-1

    Returns:
        AWS region string
    """
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-southeast-1"


def put_draft_book_item(
    table_name: str,
    book_id: str,
    file_name: str,
    file_size: int,
    title: str,
    author: str,
    description: Optional[str],
    user_id: str,
    user_email: Optional[str],
    s3_key: str,
) -> None:
    """
    Create a draft Book Metadata item in DynamoDB with status=UPLOADING.

    Args:
        table_name: DynamoDB table name
        book_id: Unique book ID
        file_name: Original file name
        file_size: File size in bytes
        title: Book title
        author: Book author
        description: Optional book description
        user_id: Uploader user ID
        user_email: Optional uploader email
        s3_key: S3 object key for the file

    Example:
        put_draft_book_item(
            table_name="OnlineLibrary",
            book_id="book-123",
            file_name="book.pdf",
            file_size=1024,
            title="My Book",
            author="John Doe",
            description="A great book",
            user_id="user-123",
            user_email="user@example.com",
            s3_key="uploads/book-123/book.pdf"
        )
    """
    table = get_dynamodb_table(table_name)

    now = datetime.now(timezone.utc)
    ttl_seconds = int((now + timedelta(hours=72)).timestamp())

    item: Dict[str, Any] = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": title,
        "author": author,
        "description": description,
        "uploaderId": user_id,
        "uploaderEmail": user_email,
        "status": "UPLOADING",
        "fileSize": file_size,
        "s3Key": s3_key,
        "ttl": ttl_seconds,
        "GSI6PK": f"UPLOADER#{user_id}",
        "GSI6SK": f"BOOK#{book_id}",
    }

    # Remove optional fields that might be None
    item = {k: v for k, v in item.items() if v is not None}

    table.put_item(Item=item)


def get_book_item(table_name: str, book_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a book metadata item from DynamoDB.

    Args:
        table_name: DynamoDB table name
        book_id: Book ID to retrieve

    Returns:
        Book metadata dictionary or None if not found

    Example:
        book = get_book_item("OnlineLibrary", "book-123")
        if book:
            print(f"Book status: {book['status']}")
    """
    table = get_dynamodb_table(table_name)

    response = table.get_item(
        Key={
            "PK": f"BOOK#{book_id}",
            "SK": "METADATA",
        }
    )

    return response.get("Item")


def update_book_status(
    table_name: str,
    book_id: str,
    status: str,
    **additional_fields,
) -> Dict[str, Any]:
    """
    Update book status and optional additional fields.

    Args:
        table_name: DynamoDB table name
        book_id: Book ID to update
        status: New status (UPLOADING, PENDING, APPROVED, REJECTED, etc.)
        **additional_fields: Additional fields to update (e.g., approvedAt, rejectedReason)

    Returns:
        Updated item

    Example:
        update_book_status(
            table_name="OnlineLibrary",
            book_id="book-123",
            status="APPROVED",
            approvedAt=datetime.now(timezone.utc).isoformat(),
            approvedBy="admin-1"
        )
    """
    table = get_dynamodb_table(table_name)

    update_expr = "SET #status = :status"
    expr_attr_names = {"#status": "status"}
    expr_attr_values = {":status": status}

    # Add additional fields
    for i, (key, value) in enumerate(additional_fields.items()):
        update_expr += f", #{key} = :{key}"
        expr_attr_names[f"#{key}"] = key
        expr_attr_values[f":{key}"] = value

    response = table.update_item(
        Key={
            "PK": f"BOOK#{book_id}",
            "SK": "METADATA",
        },
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_attr_names,
        ExpressionAttributeValues=expr_attr_values,
        ReturnValues="ALL_NEW",
    )

    return response.get("Attributes", {})


def query_by_gsi(
    table_name: str,
    gsi_name: str,
    pk_value: str,
    sk_prefix: Optional[str] = None,
) -> list:
    """
    Query items by GSI.

    Args:
        table_name: DynamoDB table name
        gsi_name: Global Secondary Index name
        pk_value: Partition key value
        sk_prefix: Optional sort key prefix for begins_with query

    Returns:
        List of items matching the query

    Example:
        # Get all books uploaded by a user
        books = query_by_gsi(
            table_name="OnlineLibrary",
            gsi_name="GSI6",
            pk_value="UPLOADER#user-123"
        )

        # Get pending books
        pending = query_by_gsi(
            table_name="OnlineLibrary",
            gsi_name="GSI5",
            pk_value="STATUS#PENDING"
        )
    """
    table = get_dynamodb_table(table_name)

    # Determine GSI key names based on GSI
    gsi_pk_map = {
        "GSI1": ("GSI1PK", "GSI1SK"),
        "GSI2": ("GSI2PK", "GSI2SK"),
        "GSI3": ("GSI3PK", "GSI3SK"),
        "GSI5": ("GSI5PK", "GSI5SK"),
        "GSI6": ("GSI6PK", "GSI6SK"),
    }

    if gsi_name not in gsi_pk_map:
        raise ValueError(f"Unknown GSI: {gsi_name}")

    pk_name, sk_name = gsi_pk_map[gsi_name]

    # Build query
    key_condition = f"{pk_name} = :pk"
    expr_attr_values = {":pk": pk_value}

    if sk_prefix:
        key_condition += f" AND begins_with({sk_name}, :sk)"
        expr_attr_values[":sk"] = sk_prefix

    response = table.query(
        IndexName=gsi_name,
        KeyConditionExpression=key_condition,
        ExpressionAttributeValues=expr_attr_values,
    )

    return response.get("Items", [])


def get_book_metadata(table_name: str, book_id: str) -> Optional[Dict[str, Any]]:
    """
    Get book metadata from DynamoDB.

    Alias for get_book_item for consistency.

    Args:
        table_name: DynamoDB table name
        book_id: Book ID to retrieve

    Returns:
        Book metadata dictionary or None if not found

    Example:
        book = get_book_metadata("OnlineLibrary", "book-123")
        if book and book.get("status") == "APPROVED":
            print(f"Book is ready to read")
    """
    return get_book_item(table_name, book_id)

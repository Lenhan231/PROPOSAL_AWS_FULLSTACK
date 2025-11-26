"""
validate_mime_type Lambda - Automatic file validation

Triggered by S3 event when file is uploaded to uploads/ folder.
Validates MIME type and automatically approves/rejects files.

Flow:
1. S3 upload complete → S3 event
2. Lambda receives S3 event
3. Check MIME type from file content
4. Update DynamoDB status:
   - APPROVED if valid (PDF/EPUB)
   - REJECTED if invalid
5. Move file:
   - Valid: uploads/{bookId}/ → public/books/{bookId}/
   - Invalid: uploads/{bookId}/ → quarantine/{bookId}/

Environment variables:
- BOOKS_TABLE_NAME: DynamoDB table name
- UPLOADS_BUCKET_NAME: S3 bucket name
- ALLOWED_MIME_TYPES: Comma-separated MIME types (e.g., application/pdf,application/epub+zip)
"""

import json
import os
from typing import Any, Dict, Optional
from datetime import datetime, timezone

import boto3
import magic

from shared.logger import get_logger
from shared.dynamodb import get_book_item, update_book_status

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    """Get environment variable or raise error if not set."""
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _get_allowed_mime_types() -> set[str]:
    """Get allowed MIME types from environment."""
    mime_types_str = _get_env_or_error("ALLOWED_MIME_TYPES")
    return {mime.strip() for mime in mime_types_str.split(",") if mime.strip()}


def _get_s3_object(bucket: str, key: str) -> bytes:
    """
    Get S3 object content.

    Args:
        bucket: S3 bucket name
        key: S3 object key

    Returns:
        Object content as bytes

    Raises:
        Exception: If S3 operation fails
    """
    s3 = boto3.client("s3")
    response = s3.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def _check_mime_type(file_content: bytes, allowed_types: set[str]) -> tuple[str, bool]:
    """
    Check MIME type of file content.

    Args:
        file_content: File content as bytes
        allowed_types: Set of allowed MIME types

    Returns:
        Tuple of (mime_type, is_valid)
    """
    try:
        mime_type = magic.from_buffer(file_content, mime=True)
        is_valid = mime_type in allowed_types
        return mime_type, is_valid
    except Exception as e:
        logger.error(f"Error checking MIME type: {str(e)}")
        return "unknown", False


def _move_s3_object(
    bucket: str,
    source_key: str,
    dest_key: str,
) -> None:
    """
    Move S3 object from source to destination.

    Args:
        bucket: S3 bucket name
        source_key: Source object key
        dest_key: Destination object key

    Raises:
        Exception: If S3 operation fails
    """
    s3 = boto3.client("s3")

    # Copy object
    s3.copy_object(
        Bucket=bucket,
        CopySource={"Bucket": bucket, "Key": source_key},
        Key=dest_key,
    )

    # Delete original
    s3.delete_object(Bucket=bucket, Key=source_key)

    logger.info(f"Moved S3 object from {source_key} to {dest_key}")


def _extract_book_id_from_key(s3_key: str) -> Optional[str]:
    """
    Extract book ID from S3 key.

    Expected format: uploads/{book_id}/{file_name}

    Args:
        s3_key: S3 object key

    Returns:
        Book ID or None if format is invalid
    """
    parts = s3_key.split("/")
    if len(parts) >= 2 and parts[0] == "uploads":
        return parts[1]
    return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for S3 event.

    Args:
        event: S3 event
        context: Lambda context

    Returns:
        Response dictionary
    """
    try:
        # Parse S3 event
        bucket = event["Records"][0]["s3"]["bucket"]["name"]
        key = event["Records"][0]["s3"]["object"]["key"]

        logger.info(f"Processing S3 object: s3://{bucket}/{key}")

        # Extract book ID
        book_id = _extract_book_id_from_key(key)
        if not book_id:
            logger.error(f"Invalid S3 key format: {key}")
            return {"statusCode": 400, "body": "Invalid S3 key format"}

        # Get environment variables
        table_name = _get_env_or_error("BOOKS_TABLE_NAME")
        allowed_mime_types = _get_allowed_mime_types()

        # Get file content from S3
        file_content = _get_s3_object(bucket, key)

        # Check MIME type
        mime_type, is_valid = _check_mime_type(file_content, allowed_mime_types)

        logger.info(f"Book {book_id}: MIME type = {mime_type}, Valid = {is_valid}")

        # Determine status and destination
        if is_valid:
            status = "APPROVED"
            dest_key = key.replace("uploads/", "public/books/")
        else:
            status = "REJECTED"
            dest_key = key.replace("uploads/", "quarantine/")

        # Move file in S3
        _move_s3_object(bucket, key, dest_key)

        # Update DynamoDB
        update_book_status(
            table_name=table_name,
            book_id=book_id,
            status=status,
            mime_type=mime_type,
        )

        logger.info(f"Book {book_id}: Status updated to {status}")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "bookId": book_id,
                "status": status,
                "mimeType": mime_type,
            }),
        }

    except Exception as e:
        logger.error(f"Error processing S3 event: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
        }

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
import mimetypes
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from shared.logger import get_logger
from shared.dynamodb import update_book_status
from shared.aws_clients import s3_client

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
    response = s3_client().get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def _check_mime_type(file_content: bytes, file_name: str, allowed_types: set[str]) -> tuple[str, bool]:
    """
    Check MIME type of file content.

    Args:
        file_content: File content as bytes
        file_name: File name for extension-based detection
        allowed_types: Set of allowed MIME types

    Returns:
        Tuple of (mime_type, is_valid)
    """
    try:
        # Method 1: Check file signature (magic bytes)
        if file_content.startswith(b'%PDF'):
            mime_type = 'application/pdf'
        elif file_content.startswith(b'PK\x03\x04') and file_name.lower().endswith('.epub'):
            mime_type = 'application/epub+zip'
        else:
            # Method 2: Fallback to extension-based detection
            mime_type, _ = mimetypes.guess_type(file_name)
            if not mime_type:
                mime_type = 'application/octet-stream'
        
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
    s3 = s3_client()

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
        from urllib.parse import unquote_plus

        key = unquote_plus(event["Records"][0]["s3"]["object"]["key"])

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

        # Extract file name from S3 key
        file_name = key.split('/')[-1]

        # Check MIME type
        mime_type, is_valid = _check_mime_type(file_content, file_name, allowed_mime_types)

        logger.info(f"Book {book_id}: MIME type = {mime_type}, Valid = {is_valid}")
        processed_at = datetime.now(timezone.utc).isoformat()

        # Determine status and destination
        if is_valid:
            # Valid file → move to staging, set status to PENDING for admin review
            status = "PENDING"
            dest_key = key.replace("uploads/", "staging/")
        else:
            # Invalid file → move to quarantine, reject immediately
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
            file_path=dest_key,
            uploadedAt=processed_at,
            rejectedReason=None if is_valid else "Invalid MIME type",
            rejectedAt=None if is_valid else processed_at,
            GSI5PK="STATUS#PENDING" if is_valid else None,
            GSI5SK=processed_at if is_valid else None,
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

"""
approve_book Lambda - Admin approve/reject books

Triggered by POST /admin/books/{bookId}/approve or /admin/books/{bookId}/reject
Moves file from staging/ to public/books/ (approve) or quarantine/ (reject)
Updates DynamoDB status

Environment variables:
- BOOKS_TABLE_NAME: DynamoDB table name
- UPLOADS_BUCKET_NAME: S3 bucket name
"""

import json
import os
from typing import Any, Dict

from shared.logger import get_logger
from shared.dynamodb import update_book_status
from shared.aws_clients import s3_client
from shared.error_handler import api_response, build_error_response, ErrorCode

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    """Get environment variable or raise error if not set."""
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


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


def _extract_book_id_from_key(s3_key: str) -> str:
    """
    Extract book ID from S3 key.

    Expected format: staging/{book_id}/{file_name}

    Args:
        s3_key: S3 object key

    Returns:
        Book ID
    """
    parts = s3_key.split("/")
    if len(parts) >= 2:
        return parts[1]
    return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for POST /admin/books/{bookId}/approve or /admin/books/{bookId}/reject

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        Response with approval result
    """
    try:
        # Extract book ID from path
        book_id = event.get("pathParameters", {}).get("bookId")
        if not book_id:
            error_body = build_error_response(
                error_code=ErrorCode.INVALID_REQUEST,
                message="Missing bookId in path",
            )
            return api_response(status_code=400, body=error_body)

        # Determine action from path
        path = event.get("rawPath", "")
        if "/approve" in path:
            action = "approve"
        elif "/reject" in path:
            action = "reject"
        else:
            error_body = build_error_response(
                error_code=ErrorCode.INVALID_REQUEST,
                message="Invalid action (must be /approve or /reject)",
            )
            return api_response(status_code=400, body=error_body)

        logger.info(f"Admin {action} book {book_id}")

        # Get environment variables
        table_name = _get_env_or_error("BOOKS_TABLE_NAME")
        bucket_name = _get_env_or_error("UPLOADS_BUCKET_NAME")

        # Get book metadata
        from shared.dynamodb import get_book_metadata
        book = get_book_metadata(table_name, book_id)
        
        if not book:
            error_body = build_error_response(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Book {book_id} not found",
            )
            return api_response(status_code=404, body=error_body)

        # Check if book is in PENDING status
        if book.get("status") != "PENDING":
            error_body = build_error_response(
                error_code=ErrorCode.INVALID_REQUEST,
                message=f"Book status is {book.get('status')}, expected PENDING",
            )
            return api_response(status_code=400, body=error_body)

        # Get file path from metadata
        file_path = book.get("file_path")
        if not file_path:
            error_body = build_error_response(
                error_code=ErrorCode.INTERNAL_ERROR,
                message="Book has no file_path in metadata",
            )
            return api_response(status_code=500, body=error_body)

        # Determine new status and destination
        if action == "approve":
            new_status = "APPROVED"
            # Move from staging/ to public/books/
            dest_key = file_path.replace("staging/", "public/books/")
        else:  # reject
            new_status = "REJECTED"
            # Move from staging/ to quarantine/
            dest_key = file_path.replace("staging/", "quarantine/")

        # Move file in S3
        _move_s3_object(bucket_name, file_path, dest_key)

        # Update DynamoDB
        update_book_status(
            table_name=table_name,
            book_id=book_id,
            status=new_status,
            file_path=dest_key,
            approved_at=None,  # Will be set by DynamoDB timestamp
            approved_by=event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("sub", "unknown"),
        )

        logger.info(f"Book {book_id}: {action}ed successfully")

        return api_response(
            status_code=200,
            body={
                "bookId": book_id,
                "action": action,
                "status": new_status,
            },
        )

    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Server configuration error",
        )
        return api_response(status_code=500, body=error_body)
    except Exception as e:
        logger.error(f"Error approving book: {str(e)}", exc_info=True)
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Internal server error",
        )
        return api_response(status_code=500, body=error_body)

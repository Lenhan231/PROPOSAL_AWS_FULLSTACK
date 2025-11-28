"""
delete_book Lambda - User deletes/unpublishes their book.

Endpoint: DELETE /books/{bookId}
- User must be owner or in Admins group.
- Removes metadata from DynamoDB and deletes associated S3 objects.
"""

import json
import os
from typing import Any, Dict, Set

from shared.auth import extract_and_validate_user, extract_jwt_claims, is_admin
from shared.dynamodb import get_book_metadata, get_dynamodb_table
from shared.aws_clients import s3_client
from shared.error_handler import (
    api_response,
    build_error_response,
    ErrorCode,
    ApiError,
)
from shared.logger import get_logger

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ApiError(ErrorCode.INTERNAL_ERROR, f"Missing required environment variable: {name}")
    return value


def _collect_keys(book: Dict[str, Any]) -> Set[str]:
    """Collect possible S3 keys to delete for the book."""
    keys: Set[str] = set()
    for key in (book.get("file_path"), book.get("s3Key")):
        if not key:
            continue
        keys.add(key)
        # Add common prefix variants
        keys.add(key.replace("staging/", "uploads/"))
        keys.add(key.replace("uploads/", "staging/"))
        keys.add(key.replace("staging/", "quarantine/"))
        keys.add(key.replace("uploads/", "quarantine/"))
        keys.add(key.replace("staging/", "public/books/"))
        keys.add(key.replace("uploads/", "public/books/"))
    return {k for k in keys if k}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        # Auth
        user_id, _ = extract_and_validate_user(event)
        claims = extract_jwt_claims(event)
        admin = is_admin(claims)

        # Params
        book_id = event.get("pathParameters", {}).get("bookId")
        if not book_id:
            err = build_error_response(ErrorCode.INVALID_REQUEST, "Missing bookId")
            return api_response(400, err)

        table_name = _get_env_or_error("BOOKS_TABLE_NAME")
        bucket_name = _get_env_or_error("UPLOADS_BUCKET_NAME")

        # Fetch metadata
        book = get_book_metadata(table_name, book_id)
        if not book:
            err = build_error_response(ErrorCode.NOT_FOUND, f"Book {book_id} not found")
            return api_response(404, err)

        # Ownership check (admins bypass)
        owner_id = book.get("uploaderId")
        if not admin and owner_id and owner_id != user_id:
            err = build_error_response(ErrorCode.FORBIDDEN, "Not allowed to delete this book")
            return api_response(403, err)

        # Delete S3 objects (best-effort)
        s3 = s3_client()
        for key in _collect_keys(book):
            try:
                s3.delete_object(Bucket=bucket_name, Key=key)
            except Exception:
                pass

        # Delete metadata
        table = get_dynamodb_table(table_name)
        table.delete_item(Key={"PK": f"BOOK#{book_id}", "SK": "METADATA"})

        logger.info(f"Book {book_id} deleted by {user_id} (admin={admin})")

        return api_response(
            200,
            {
                "bookId": book_id,
                "status": "DELETED",
            },
        )

    except ApiError as e:
        err = build_error_response(e.error_code, e.message)
        return api_response(e.status_code or 500, err)
    except Exception as e:
        logger.error(f"Error deleting book: {e}", exc_info=True)
        err = build_error_response(ErrorCode.INTERNAL_ERROR, "Internal server error")
        return api_response(500, err)

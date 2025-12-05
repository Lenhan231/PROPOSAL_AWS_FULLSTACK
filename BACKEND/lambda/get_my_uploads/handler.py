import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from shared.auth import extract_and_validate_user
from shared.dynamodb import query_by_gsi
from shared.error_handler import (
    lambda_handler_wrapper,
    api_response,
    ApiError,
    ErrorCode,
)
from shared.logger import get_logger

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    """Get environment variable or raise error if not set."""
    value = os.getenv(name)
    if not value:
        raise ApiError(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Missing required environment variable: {name}",
        )
    return value


def _parse_timestamp(value: Optional[str]) -> float:
    """
    Convert ISO8601 string to sortable timestamp.

    Returns 0 if parsing fails.
    """
    if not value:
        return 0
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


def _format_book(item: Dict[str, Any]) -> Dict[str, Any]:
    """Map DynamoDB item to response shape."""
    uploaded_at = item.get("uploadedAt") or item.get("createdAt")

    book: Dict[str, Any] = {
        "bookId": item.get("bookId"),
        "title": item.get("title"),
        "author": item.get("author"),
        "description": item.get("description"),
        "status": item.get("status"),
        "uploadedAt": uploaded_at,
    }

    status = (item.get("status") or "").upper()
    if status == "APPROVED":
        book["approvedAt"] = item.get("approvedAt") or item.get("approved_at")
    if status.startswith("REJECTED"):
        book["rejectedAt"] = item.get("rejectedAt")
        book["rejectedReason"] = item.get("rejectedReason")

    return book


@lambda_handler_wrapper
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle GET /books/my-uploads."""
    # Auth
    user_id, _ = extract_and_validate_user(event)

    # Pagination params
    query_params = event.get("queryStringParameters") or {}
    try:
        limit = int(query_params.get("limit", 20))
        offset = int(query_params.get("offset", 0))
    except ValueError:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="limit and offset must be integers",
        )

    if limit < 1 or limit > 100:
        limit = 20
    if offset < 0:
        offset = 0

    table_name = _get_env_or_error("BOOKS_TABLE_NAME")

    # Query by uploader via GSI6
    items = query_by_gsi(
        table_name=table_name,
        gsi_name="GSI6",
        pk_value=f"UPLOADER#{user_id}",
        sk_prefix="BOOK#",
    )

    # Only metadata items
    metadata_items: List[Dict[str, Any]] = [
        item for item in items if item.get("SK") == "METADATA"
    ]

    # Sort by uploadedAt (or createdAt) desc
    metadata_items.sort(
        key=lambda item: _parse_timestamp(item.get("uploadedAt") or item.get("createdAt")),
        reverse=True,
    )

    total = len(metadata_items)
    page = metadata_items[offset : offset + limit]
    books = [_format_book(item) for item in page]

    logger.info(
        "Fetched user uploads",
        extra={
            "userId": user_id,
            "count": len(books),
            "total": total,
            "offset": offset,
            "limit": limit,
        },
    )

    return api_response(
        status_code=200,
        body={
            "books": books,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": total,
                "hasMore": offset + limit < total,
            },
        },
    )

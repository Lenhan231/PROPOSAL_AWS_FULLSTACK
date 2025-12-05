"""
list_pending_books Lambda - List books pending admin approval

Triggered by GET /admin/books/pending
Returns list of books with status=PENDING

Query parameters:
- limit: Max results (default: 20, max: 100)
- offset: Pagination offset (default: 0)

Environment variables:
- BOOKS_TABLE_NAME: DynamoDB table name
"""

import json
import os
from typing import Any, Dict, List, Tuple

from boto3.dynamodb.conditions import Key, Attr

from shared.logger import get_logger
from shared.dynamodb import get_dynamodb_table
from shared.error_handler import api_response, build_error_response, ErrorCode

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    """Get environment variable or raise error if not set."""
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _list_pending_books(
    table_name: str,
    limit: int = 20,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """
    List books pending admin approval.

    Args:
        table_name: DynamoDB table name
        limit: Max results
        offset: Pagination offset

    Returns:
        Tuple of (books list, total count)
    """
    table = get_dynamodb_table(table_name)

    items: List[Dict[str, Any]] = []
    missing_gsi_items: List[Dict[str, Any]] = []

    # Try fast path via GSI5 if available; otherwise fallback to scan
    try:
        response = table.query(
            IndexName="GSI5",
            KeyConditionExpression=Key("GSI5PK").eq("STATUS#PENDING"),
        )
        items = response.get("Items", [])
    except Exception:
        # Fallback: full table scan
        response = table.scan(
            FilterExpression="attribute_exists(#status) AND #status = :status",
            ExpressionAttributeNames={
                "#status": "status",
            },
            ExpressionAttributeValues={
                ":status": "PENDING",
            },
        )
        items = response.get("Items", [])

    # Also include legacy items missing GSI5 attributes
    try:
        resp_missing = table.scan(
            FilterExpression=Attr("status").eq("PENDING")
            & (Attr("GSI5PK").not_exists() | Attr("GSI5SK").not_exists()),
        )
        missing_gsi_items = resp_missing.get("Items", [])
    except Exception:
        missing_gsi_items = []

    # Merge and deduplicate by PK/SK
    merged: Dict[tuple, Dict[str, Any]] = {}
    for item in items + missing_gsi_items:
        key = (item.get("PK"), item.get("SK"))
        merged[key] = item
    merged_items = list(merged.values())

    # Sort by uploadedAt/createdAt desc so newest first
    def _ts(book: Dict[str, Any]) -> Any:
        return book.get("uploadedAt") or book.get("createdAt") or ""

    merged_items.sort(key=_ts, reverse=True)

    # Apply pagination
    total = len(merged_items)
    books = merged_items[offset : offset + limit]

    # Format response
    formatted_books = []
    for book in books:
        status = book.get("status") or "PENDING"
        uploaded_at = book.get("uploadedAt") or book.get("createdAt")
        file_size = book.get("fileSize") or book.get("file_size")
        formatted_books.append({
            "bookId": book.get("bookId"),
            "title": book.get("title"),
            "author": book.get("author"),
            "description": book.get("description"),
            "status": status,
            "uploadedBy": book.get("uploaderEmail"),
            "uploadedAt": uploaded_at,
            "mimeType": book.get("mime_type"),
            "fileSize": file_size,
        })

    return formatted_books, total


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for GET /admin/books/pending

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        Response with pending books list
    """
    try:
        # Get query parameters
        query_params = event.get("queryStringParameters") or {}
        
        try:
            limit = int(query_params.get("limit", 20))
            offset = int(query_params.get("offset", 0))
        except ValueError:
            error_body = build_error_response(
                error_code=ErrorCode.INVALID_REQUEST,
                message="limit and offset must be integers",
            )
            return api_response(status_code=400, body=error_body)

        # Validate pagination
        if limit < 1 or limit > 100:
            limit = 20
        if offset < 0:
            offset = 0

        logger.info(f"Listing pending books: limit={limit}, offset={offset}")

        # Get environment variables
        table_name = _get_env_or_error("BOOKS_TABLE_NAME")

        # List pending books
        books, total = _list_pending_books(
            table_name=table_name,
            limit=limit,
            offset=offset,
        )

        logger.info(f"Found {len(books)} pending books (total: {total})")

        return api_response(
            status_code=200,
            body=json.loads(json.dumps({
                "books": books,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "hasMore": offset + limit < total,
                },
            }, default=lambda o: float(o))),
        )

    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Server configuration error",
        )
        return api_response(status_code=500, body=error_body)
    except Exception as e:
        logger.error(f"Error listing pending books: {str(e)}", exc_info=True)
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Internal server error",
        )
        return api_response(status_code=500, body=error_body)

"""
search_books Lambda - Search and list books

Triggered by GET /books/search
Returns list of approved books with optional filtering.

Query parameters:
- q: Search query (title, author)
- limit: Max results (default: 20, max: 100)
- offset: Pagination offset (default: 0)

Environment variables:
- BOOKS_TABLE_NAME: DynamoDB table name
"""

import json
import os
from typing import Any, Dict, List, Optional
from decimal import Decimal

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


def _search_books(
    table_name: str,
    query: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """
    Search approved books.

    Args:
        table_name: DynamoDB table name
        query: Search query (searches title and author)
        limit: Max results
        offset: Pagination offset

    Returns:
        Tuple of (books list, total count)
    """
    table = get_dynamodb_table(table_name)

    # Query all approved books
    # Note: In production, use GSI for better performance
    response = table.scan(
        FilterExpression="attribute_exists(#status) AND #status = :status",
        ExpressionAttributeNames={
            "#status": "status",
        },
        ExpressionAttributeValues={
            ":status": "APPROVED",
        },
    )

    books = response.get("Items", [])

    # Filter by search query if provided
    if query:
        query_lower = query.lower()
        books = [
            book for book in books
            if query_lower in book.get("title", "").lower()
            or query_lower in book.get("author", "").lower()
        ]

    # Apply pagination
    total = len(books)
    books = books[offset : offset + limit]

    # Format response
    formatted_books = []
    for book in books:
        uploaded_at = book.get("uploadedAt") or book.get("createdAt")
        formatted_books.append({
            "bookId": book.get("bookId"),
            "title": book.get("title"),
            "author": book.get("author"),
            "description": book.get("description"),
            "status": book.get("status"),
            "uploadedAt": uploaded_at,
            "fileSize": book.get("fileSize") or book.get("file_size"),
            "uploaderEmail": book.get("uploaderEmail"),
            "approvedAt": book.get("approvedAt"),
        })

    return formatted_books, total


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for GET /books/search

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        Response with books list
    """
    try:
        # Get query parameters
        query_params = event.get("queryStringParameters") or {}
        search_query = query_params.get("q", "").strip()
        
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

        logger.info(f"Searching books: query={search_query}, limit={limit}, offset={offset}")

        # Get environment variables
        table_name = _get_env_or_error("BOOKS_TABLE_NAME")

        # Search books
        books, total = _search_books(
            table_name=table_name,
            query=search_query if search_query else None,
            limit=limit,
            offset=offset,
        )

        logger.info(f"Found {len(books)} books (total: {total})")

        return api_response(
            status_code=200,
            body=json.loads(json.dumps({  # convert Decimals to float/int
                "books": books,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "hasMore": offset + limit < total,
                },
            }, default=lambda o: float(o) if isinstance(o, Decimal) else o)),
        )

    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Server configuration error",
        )
        return api_response(status_code=500, body=error_body)
    except Exception as e:
        logger.error(f"Error searching books: {str(e)}", exc_info=True)
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Internal server error",
        )
        return api_response(status_code=500, body=error_body)

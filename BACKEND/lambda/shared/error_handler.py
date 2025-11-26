"""
Shared error handling utilities for Lambda functions.

Provides ApiError class and error response builder for consistent error handling
across all Lambda functions.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import json


class ErrorCode(str, Enum):
    """Machine-readable error codes for API responses."""
    INVALID_REQUEST = "INVALID_REQUEST"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE"
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"
    INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass
class ApiError(Exception):
    """Exception class for API errors with error code and HTTP status."""
    error_code: ErrorCode
    message: str
    status_code: Optional[int] = None

    def __post_init__(self):
        """Set default status code based on error code if not provided."""
        if self.status_code is None:
            status_map = {
                ErrorCode.INVALID_REQUEST: 400,
                ErrorCode.UNAUTHORIZED: 401,
                ErrorCode.FORBIDDEN: 403,
                ErrorCode.NOT_FOUND: 404,
                ErrorCode.FILE_TOO_LARGE: 413,
                ErrorCode.UNSUPPORTED_MEDIA_TYPE: 415,
                ErrorCode.TOO_MANY_REQUESTS: 429,
                ErrorCode.INTERNAL_ERROR: 500,
            }
            self.status_code = status_map.get(self.error_code, 500)

    def __str__(self):
        return f"{self.error_code}: {self.message}"


def build_error_response(
    error_code: ErrorCode,
    message: str,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build a standardized error response body.

    Args:
        error_code: Machine-readable error code
        message: Human-friendly error message
        request_id: Optional request ID for tracing

    Returns:
        Dictionary with error response structure
    """
    return {
        "error": message,
        "code": error_code.value,
        "requestId": request_id or "unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def api_response(
    status_code: int,
    body: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Build a standardized API Gateway HTTP API response.

    Args:
        status_code: HTTP status code
        body: Response body as dictionary
        headers: Optional custom headers

    Returns:
        API Gateway HTTP API response format
    """
    default_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    }
    if headers:
        default_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": default_headers,
        "body": json.dumps(body),
    }


def lambda_handler_wrapper(handler_func):
    """
    Decorator for Lambda handlers to provide consistent error handling.

    Catches ApiError and generic exceptions, returns standardized error responses.
    """
    def wrapper(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        request_id = context.request_id if hasattr(context, "request_id") else "unknown"

        try:
            return handler_func(event, context)
        except ApiError as err:
            error_body = build_error_response(
                error_code=err.error_code,
                message=err.message,
                request_id=request_id,
            )
            return api_response(status_code=err.status_code, body=error_body)
        except Exception as err:
            error_body = build_error_response(
                error_code=ErrorCode.INTERNAL_ERROR,
                message="An unexpected error occurred",
                request_id=request_id,
            )
            return api_response(status_code=500, body=error_body)

    return wrapper

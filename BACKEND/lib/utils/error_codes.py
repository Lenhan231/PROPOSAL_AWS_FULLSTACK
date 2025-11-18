# utils/error_codes.py

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class ErrorInfo:
    code: str
    http_status: int


class ErrorCode:
    """Central place for all application error codes."""

    # 4xx
    INVALID_REQUEST = "INVALID_REQUEST"          # 400
    UNAUTHORIZED = "UNAUTHORIZED"                # 401
    FORBIDDEN = "FORBIDDEN"                      # 403
    NOT_FOUND = "NOT_FOUND"                      # 404
    FILE_TOO_LARGE = "FILE_TOO_LARGE"            # 413
    UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE"  # 415
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"      # 429

    # 5xx
    INTERNAL_ERROR = "INTERNAL_ERROR"            # 500


# Mapping code → (code, http_status)
ERROR_DEFINITIONS: Dict[str, ErrorInfo] = {
    ErrorCode.INVALID_REQUEST: ErrorInfo(ErrorCode.INVALID_REQUEST, 400),
    ErrorCode.UNAUTHORIZED: ErrorInfo(ErrorCode.UNAUTHORIZED, 401),
    ErrorCode.FORBIDDEN: ErrorInfo(ErrorCode.FORBIDDEN, 403),
    ErrorCode.NOT_FOUND: ErrorInfo(ErrorCode.NOT_FOUND, 404),
    ErrorCode.FILE_TOO_LARGE: ErrorInfo(ErrorCode.FILE_TOO_LARGE, 413),
    ErrorCode.UNSUPPORTED_MEDIA_TYPE: ErrorInfo(
        ErrorCode.UNSUPPORTED_MEDIA_MEDIA_TYPE
        if (UNSUPPORTED_MEDIA_TYPE := ErrorCode.UNSUPPORTED_MEDIA_TYPE)
        else "UNSUPPORTED_MEDIA_TYPE",  # trick nhỏ để IDE đỡ báo unused
        415,
    ),
    ErrorCode.TOO_MANY_REQUESTS: ErrorInfo(ErrorCode.TOO_MANY_REQUESTS, 429),
    ErrorCode.INTERNAL_ERROR: ErrorInfo(ErrorCode.INTERNAL_ERROR, 500),
}


def get_http_status(error_code: str) -> int:
    """
    Resolve HTTP status from error code.
    Default to 500 if something lạ.
    """
    info = ERROR_DEFINITIONS.get(error_code)
    return info.http_status if info else 500

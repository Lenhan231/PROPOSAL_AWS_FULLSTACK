# utils/error_handler.py

from __future__ import annotations
import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, TypeVar, cast

from utils.error_codes import ErrorCode, get_http_status

logger = logging.getLogger()
logger.setLevel(logging.INFO)

T = TypeVar("T")


@dataclass
class AppError(Exception):
    """
    Application-level error.

    Dùng cho những case mình chủ động muốn trả về lỗi 4xx rõ ràng:
    - validation fail
    - không đủ quyền
    - resource không tồn tại
    """

    error_code: str
    message: str
    http_status: Optional[int] = None
    details: Optional[Dict[str, Any]] = None

    def to_response(self) -> Dict[str, Any]:
        status = self.http_status or get_http_status(self.error_code)
        body: Dict[str, Any] = {
            "errorCode": self.error_code,
            "message": self.message,
        }
        if self.details:
            body["details"] = self.details

        return {
            "statusCode": status,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(body),
        }


def api_response(status_code: int = 200, body: Any = None) -> Dict[str, Any]:
    """Success response helper."""
    if body is None:
        body = {}
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def api_error(
    error_code: str,
    message: str,
    *,
    http_status: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Error response helper (không cần raise AppError nếu anh chỉ muốn return)."""
    err = AppError(
        error_code=error_code,
        message=message,
        http_status=http_status,
        details=details,
    )
    return err.to_response()


def lambda_handler_wrapper(
    func: Callable[[Dict[str, Any], Any], Dict[str, Any]]
) -> Callable[[Dict[str, Any], Any], Dict[str, Any]]:
    """
    Decorator để catch AppError & exception không mong muốn:

    @lambda_handler_wrapper
    def handler(event, context):
        ...
    """

    def wrapper(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        try:
            return func(event, context)
        except AppError as e:
            # lỗi business mình control được
            logger.info(f"AppError: {e.error_code} - {e.message} - {e.details}")
            return e.to_response()
        except Exception as e:
            # lỗi bất ngờ -> 500
            logger.exception("Unhandled exception in Lambda handler")
            return api_error(
                ErrorCode.INTERNAL_ERROR,
                "Internal server error",
                http_status=500,
            )

    return cast(Callable[[Dict[str, Any], Any], Dict[str, Any]], wrapper)

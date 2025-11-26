"""
Shared structured logging utility for Lambda functions.

Provides JSON-formatted logging with consistent fields for CloudWatch.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class JsonFormatter(logging.Formatter):
    """Custom formatter that outputs logs as JSON."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "requestId"):
            log_data["requestId"] = record.requestId
        if hasattr(record, "userId"):
            log_data["userId"] = record.userId
        if hasattr(record, "action"):
            log_data["action"] = record.action
        if hasattr(record, "status"):
            log_data["status"] = record.status

        return json.dumps(log_data)


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger with JSON formatting.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()

    # Add handler with JSON formatter
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)

    return logger


def log_action(
    logger: logging.Logger,
    action: str,
    status: str,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    **extra_fields,
) -> None:
    """
    Log an action with structured fields.

    Args:
        logger: Logger instance
        action: Action name (e.g., "UPLOAD_INITIATED", "BOOK_APPROVED")
        status: Status (e.g., "SUCCESS", "FAILED")
        request_id: Optional request ID for tracing
        user_id: Optional user ID
        **extra_fields: Additional fields to include in log
    """
    log_record = logging.LogRecord(
        name=logger.name,
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg=f"{action}: {status}",
        args=(),
        exc_info=None,
    )

    log_record.requestId = request_id
    log_record.userId = user_id
    log_record.action = action
    log_record.status = status

    # Add extra fields
    for key, value in extra_fields.items():
        setattr(log_record, key, value)

    logger.handle(log_record)

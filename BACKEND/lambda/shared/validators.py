"""
Shared input validation utilities for Lambda functions.

Provides validation functions for common input types and constraints.
"""

import re
from typing import Any, Dict, Optional, Set
from .error_handler import ApiError, ErrorCode


def validate_required_fields(data: Dict[str, Any], required_fields: list[str]) -> None:
    """
    Validate that all required fields are present in data.

    Args:
        data: Dictionary to validate
        required_fields: List of required field names

    Raises:
        ApiError: If any required field is missing
    """
    missing = [field for field in required_fields if field not in data or data[field] is None]
    if missing:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"Missing required fields: {', '.join(missing)}",
        )


def validate_string_field(
    value: Any,
    field_name: str,
    min_length: int = 1,
    max_length: Optional[int] = None,
) -> str:
    """
    Validate and return a string field.

    Args:
        value: Value to validate
        field_name: Field name for error messages
        min_length: Minimum string length
        max_length: Maximum string length (optional)

    Returns:
        Validated string

    Raises:
        ApiError: If validation fails
    """
    if not isinstance(value, str):
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must be a string",
        )

    if len(value) < min_length:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must be at least {min_length} character(s)",
        )

    if max_length and len(value) > max_length:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must not exceed {max_length} characters",
        )

    return value


def validate_integer_field(
    value: Any,
    field_name: str,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None,
) -> int:
    """
    Validate and return an integer field.

    Args:
        value: Value to validate
        field_name: Field name for error messages
        min_value: Minimum value (optional)
        max_value: Maximum value (optional)

    Returns:
        Validated integer

    Raises:
        ApiError: If validation fails
    """
    try:
        int_value = int(value)
    except (TypeError, ValueError):
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must be an integer",
        )

    if min_value is not None and int_value < min_value:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must be at least {min_value}",
        )

    if max_value is not None and int_value > max_value:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must not exceed {max_value}",
        )

    return int_value


def validate_file_extension(
    file_name: str,
    allowed_extensions: Set[str],
) -> str:
    """
    Validate file extension.

    Args:
        file_name: File name to validate
        allowed_extensions: Set of allowed extensions (lowercase, with dot, e.g. {'.pdf', '.epub'})

    Returns:
        Validated file extension

    Raises:
        ApiError: If extension not allowed
    """
    if not file_name:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="File name must not be empty",
        )

    # Extract extension
    parts = file_name.rsplit(".", 1)
    if len(parts) != 2:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="File must have an extension",
        )

    extension = f".{parts[1].lower()}"

    if extension not in allowed_extensions:
        raise ApiError(
            error_code=ErrorCode.UNSUPPORTED_MEDIA_TYPE,
            message=f"File extension {extension} not allowed. Allowed: {', '.join(sorted(allowed_extensions))}",
        )

    return extension


def validate_file_size(
    file_size: int,
    max_size_bytes: int,
) -> int:
    """
    Validate file size.

    Args:
        file_size: File size in bytes
        max_size_bytes: Maximum allowed size in bytes

    Returns:
        Validated file size

    Raises:
        ApiError: If file size exceeds limit
    """
    if file_size <= 0:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="File size must be positive",
        )

    if file_size > max_size_bytes:
        raise ApiError(
            error_code=ErrorCode.FILE_TOO_LARGE,
            message=f"File size exceeds maximum allowed limit of {max_size_bytes} bytes",
        )

    return file_size


def validate_email(email: str) -> str:
    """
    Validate email format.

    Args:
        email: Email address to validate

    Returns:
        Validated email

    Raises:
        ApiError: If email format is invalid
    """
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(email_pattern, email):
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="Invalid email format",
        )
    return email


def validate_enum_field(
    value: Any,
    field_name: str,
    allowed_values: Set[str],
) -> str:
    """
    Validate that value is one of allowed values.

    Args:
        value: Value to validate
        field_name: Field name for error messages
        allowed_values: Set of allowed values

    Returns:
        Validated value

    Raises:
        ApiError: If value not in allowed set
    """
    if value not in allowed_values:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=f"{field_name} must be one of: {', '.join(sorted(allowed_values))}",
        )
    return value


def sanitize_string(value: str, max_length: Optional[int] = None) -> str:
    """
    Sanitize string by removing/escaping potentially harmful characters.

    Args:
        value: String to sanitize
        max_length: Optional maximum length after sanitization

    Returns:
        Sanitized string
    """
    # Remove control characters
    sanitized = "".join(char for char in value if ord(char) >= 32 or char in "\n\r\t")

    # Truncate if needed
    if max_length:
        sanitized = sanitized[:max_length]

    return sanitized.strip()

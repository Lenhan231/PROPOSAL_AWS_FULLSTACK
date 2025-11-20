"""
Shared authentication utilities for Lambda functions.

Provides JWT claims extraction and admin authorization checks.
"""

from typing import Any, Dict, Optional
from .error_handler import ApiError, ErrorCode


def extract_jwt_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract JWT claims from an API Gateway HTTP API event.

    Args:
        event: API Gateway HTTP API event

    Returns:
        Dictionary of JWT claims

    Raises:
        ApiError: If claims cannot be extracted
    """
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    if not claims:
        raise ApiError(
            error_code=ErrorCode.UNAUTHORIZED,
            message="Missing authentication claims",
        )

    return claims


def get_user_id(claims: Dict[str, Any]) -> str:
    """
    Extract user ID (sub claim) from JWT claims.

    Args:
        claims: JWT claims dictionary

    Returns:
        User ID

    Raises:
        ApiError: If user ID not found
    """
    user_id = claims.get("sub")
    if not user_id:
        raise ApiError(
            error_code=ErrorCode.UNAUTHORIZED,
            message="Missing user id in JWT claims",
        )
    return user_id


def get_user_email(claims: Dict[str, Any]) -> Optional[str]:
    """
    Extract email from JWT claims.

    Args:
        claims: JWT claims dictionary

    Returns:
        Email address or None if not present
    """
    return claims.get("email")


def is_admin(claims: Dict[str, Any]) -> bool:
    """
    Check if user is in Admin group.

    Args:
        claims: JWT claims dictionary

    Returns:
        True if user is admin, False otherwise
    """
    groups = claims.get("cognito:groups", [])
    return "Admins" in groups


def require_admin(claims: Dict[str, Any]) -> None:
    """
    Require that user is an admin, raise error if not.

    Args:
        claims: JWT claims dictionary

    Raises:
        ApiError: If user is not admin
    """
    if not is_admin(claims):
        raise ApiError(
            error_code=ErrorCode.FORBIDDEN,
            message="Admin access required",
        )


def extract_and_validate_user(event: Dict[str, Any]) -> tuple[str, Optional[str]]:
    """
    Extract and validate user information from event.

    Args:
        event: API Gateway HTTP API event

    Returns:
        Tuple of (user_id, user_email)

    Raises:
        ApiError: If user information is invalid
    """
    claims = extract_jwt_claims(event)
    user_id = get_user_id(claims)
    user_email = get_user_email(claims)
    return user_id, user_email

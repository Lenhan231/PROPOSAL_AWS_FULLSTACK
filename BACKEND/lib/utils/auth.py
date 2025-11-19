from typing import Dict, Any, Optional
from .error_handler import ApiError


def extract_jwt_claims(event: dict) -> Dict[str, Any]:
    """Extract JWT claims from API Gateway event"""
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {})
        
        if not claims:
            raise ApiError(
                message="No JWT claims found",
                code="UNAUTHORIZED",
                status_code=401
            )
        
        return claims
    except Exception as e:
        raise ApiError(
            message="Failed to extract JWT claims",
            code="AUTH_ERROR",
            status_code=401,
            details={"error": str(e)}
        )


def get_user_id(claims: Dict[str, Any]) -> str:
    """Get user ID from JWT claims"""
    user_id = claims.get("sub")
    if not user_id:
        raise ApiError(
            message="User ID not found in JWT claims",
            code="INVALID_JWT",
            status_code=401
        )
    return user_id


def get_user_email(claims: Dict[str, Any]) -> str:
    """Get user email from JWT claims"""
    email = claims.get("email")
    if not email:
        raise ApiError(
            message="Email not found in JWT claims",
            code="INVALID_JWT",
            status_code=401
        )
    return email


def check_admin_group(claims: Dict[str, Any]) -> bool:
    """Check if user is in Admins group"""
    groups = claims.get("cognito:groups", [])
    return "Admins" in groups


def require_admin(claims: Dict[str, Any]) -> None:
    """Require user to be admin"""
    if not check_admin_group(claims):
        raise ApiError(
            message="Admin access required",
            code="FORBIDDEN",
            status_code=403
        )

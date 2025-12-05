"""Get the current user's profile from DynamoDB."""

import os
from typing import Any, Dict

from shared.auth import extract_and_validate_user
from shared.dynamodb import get_dynamodb_table
from shared.error_handler import (
    ApiError,
    ErrorCode,
    api_response,
    lambda_handler_wrapper,
)
from shared.logger import get_logger

logger = get_logger(__name__)
user_profile_table_name = os.environ.get("USER_PROFILE_TABLE", "UserProfile")


@lambda_handler_wrapper
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Return the caller's profile stored in DynamoDB."""
    user_id, _ = extract_and_validate_user(event)
    table = get_dynamodb_table(user_profile_table_name)

    response = table.get_item(Key={"user_id": user_id})
    item = response.get("Item")
    if not item:
        raise ApiError(
            error_code=ErrorCode.NOT_FOUND,
            message="User profile not found",
        )

    profile = {
        "user_id": user_id,
        "email": item.get("email"),
        "user_name": item.get("user_name"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }

    logger.info(
        "Fetched profile",
        extra={"userId": user_id, "action": "GET_PROFILE"},
    )

    return api_response(status_code=200, body={"profile": profile})

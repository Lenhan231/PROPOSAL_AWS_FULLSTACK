# lambda/update_user_profile/handler.py
"""Update user profile stored in DynamoDB (not Cognito)."""

import json
import os
from datetime import datetime
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


def _parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse and validate JSON body."""
    try:
        return json.loads(event.get("body") or "{}")
    except json.JSONDecodeError as exc:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="Invalid JSON body",
        ) from exc


@lambda_handler_wrapper
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Update user_name in the UserProfile table."""
    # Auth
    user_id, _ = extract_and_validate_user(event)

    body = _parse_body(event)
    user_name = (body.get("user_name") or "").strip()
    if not user_name:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="user_name cannot be empty",
        )

    table = get_dynamodb_table(user_profile_table_name)
    now = datetime.utcnow().isoformat()
    table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET user_name = :name, updated_at = :now",
        ExpressionAttributeValues={
            ":name": user_name,
            ":now": now,
        },
    )

    logger.info(
        "Updated profile",
        extra={"userId": user_id, "userName": user_name, "action": "UPDATE_PROFILE"},
    )

    return api_response(
        status_code=200,
        body={
            "message": "Profile updated",
            "user_name": user_name,
            "updated_at": now,
        },
    )

"""
Lambda entrypoint for the `get_read_url` function.

This function generates a CloudFront signed URL for reading an approved book.
The URL is valid for 1 hour and can only be used to access files in the
public/books/ prefix via CloudFront.

Environment variables expected:
- BOOKS_TABLE_NAME: DynamoDB table name (e.g. OnlineLibrary)
- CLOUDFRONT_DOMAIN: CloudFront domain name (e.g. d123456.cloudfront.net)
- CLOUDFRONT_KEY_PAIR_ID: CloudFront key pair ID for signing
- CLOUDFRONT_PRIVATE_KEY: CloudFront private key for signing (base64 encoded)
- READ_URL_TTL_SECONDS: (optional) TTL for signed URL, default 3600 (1 hour)
"""

import base64
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import boto3
from botocore.signers import CloudFrontSigner

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.error_handler import (
    lambda_handler_wrapper,
    api_response,
    ApiError,
    ErrorCode,
)
from shared.validators import validate_string_field
from shared.auth import extract_and_validate_user
from shared.logger import get_logger
from shared.dynamodb import get_book_item

logger = get_logger(__name__)


def _get_cloudfront_private_key() -> str:
    """
    Retrieve CloudFront private key from AWS Secrets Manager.

    Returns:
        Base64-encoded private key

    Raises:
        ApiError: If secret cannot be retrieved
    """
    secret_arn = os.getenv("CLOUDFRONT_PRIVATE_KEY_SECRET_ARN")
    if not secret_arn:
        raise ApiError(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="CloudFront private key not configured",
        )

    try:
        region = os.getenv("AWS_REGION") or "ap-southeast-1"
        secrets_client = boto3.client("secretsmanager", region_name=region)
        response = secrets_client.get_secret_value(SecretId=secret_arn)

        # Secret value is base64-encoded private key
        if "SecretString" in response:
            return response["SecretString"]
        else:
            return base64.b64decode(response["SecretBinary"]).decode("utf-8")
    except Exception as err:
        raise ApiError(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Failed to retrieve CloudFront private key",
        )


def _validate_book_approved(book: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate that book exists and is approved.

    Args:
        book: Book metadata dictionary or None

    Returns:
        Book metadata if valid

    Raises:
        ApiError: If book not found or not approved
    """
    if not book:
        raise ApiError(
            error_code=ErrorCode.NOT_FOUND,
            message="Book not found",
        )

    if book.get("status") != "APPROVED":
        raise ApiError(
            error_code=ErrorCode.FORBIDDEN,
            message="Book is not approved for reading",
        )

    return book


def _create_cloudfront_signed_url(
    cloudfront_domain: str,
    s3_key: str,
    expires_in_seconds: int,
    key_pair_id: str,
    private_key: str,
) -> str:
    """
    Create a CloudFront signed URL for accessing a file.

    Args:
        cloudfront_domain: CloudFront domain name
        s3_key: S3 object key
        expires_in_seconds: URL expiration time in seconds
        key_pair_id: CloudFront key pair ID
        private_key: CloudFront private key (base64 encoded)

    Returns:
        Signed URL

    Raises:
        ApiError: If URL generation fails
    """
    try:
        # Decode private key from base64
        private_key_bytes = base64.b64decode(private_key)

        # Create CloudFront signer
        signer = CloudFrontSigner(key_pair_id, lambda message: private_key_bytes)

        # Build URL
        url = f"https://{cloudfront_domain}/{s3_key}"

        # Generate signed URL
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
        signed_url = signer.generate_presigned_url(
            url,
            date_less_than=expires_at,
        )

        return signed_url
    except Exception as err:
        raise ApiError(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Failed to generate read URL",
        )


def _get_env_or_error(name: str) -> str:
    """Get environment variable or raise error if not set."""
    value = os.getenv(name)
    if not value:
        raise ApiError(
            error_code=ErrorCode.INTERNAL_ERROR,
            message=f"Missing required environment variable: {name}",
        )
    return value


@lambda_handler_wrapper
def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for getReadUrl.

    Expects an API Gateway HTTP API event with:
    - Path parameter: bookId
    - JWT authorization from Cognito

    Returns:
    - 200: Signed CloudFront URL
    - 401: Unauthorized
    - 403: Book not approved
    - 404: Book not found
    - 500: Internal error
    """
    # 1) Auth
    user_id, user_email = extract_and_validate_user(event)

    # 2) Extract book ID from path
    path_params = event.get("pathParameters") or {}
    book_id = path_params.get("bookId")
    if not book_id:
        raise ApiError(
            error_code=ErrorCode.INVALID_REQUEST,
            message="Missing bookId path parameter",
        )

    book_id = validate_string_field(book_id, "bookId", min_length=1)

    # 3) Env config
    table_name = _get_env_or_error("BOOKS_TABLE_NAME")
    cloudfront_domain = _get_env_or_error("CLOUDFRONT_DOMAIN")
    key_pair_id = _get_env_or_error("CLOUDFRONT_KEY_PAIR_ID")
    private_key = _get_cloudfront_private_key()  # Retrieve from Secrets Manager
    expires_in = int(os.getenv("READ_URL_TTL_SECONDS", "3600"))

    # 4) Get book from DynamoDB
    book = get_book_item(table_name, book_id)
    book = _validate_book_approved(book)

    # 5) Generate CloudFront signed URL
    s3_key = book.get("s3Key")
    if not s3_key:
        raise ApiError(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Book metadata missing S3 key",
        )

    signed_url = _create_cloudfront_signed_url(
        cloudfront_domain=cloudfront_domain,
        s3_key=s3_key,
        expires_in_seconds=expires_in,
        key_pair_id=key_pair_id,
        private_key=private_key,
    )

    # 6) Log action
    logger.info(
        f"Read URL generated for book {book_id}",
        extra={
            "requestId": context.request_id if hasattr(context, "request_id") else "unknown",
            "userId": user_id,
            "action": "GET_READ_URL",
            "status": "SUCCESS",
            "bookId": book_id,
        },
    )

    # 7) Success response
    return api_response(
        200,
        {
            "readUrl": signed_url,
            "expiresIn": expires_in,
            "bookId": book_id,
        },
    )

"""
Lambda entrypoint for the `create_upload_url` function.

This function generates a pre-signed S3 PUT URL so that
the frontend can upload a file directly to S3, and it
creates a draft Book Metadata item in DynamoDB with
status=UPLOADING and a TTL of 72 hours.

Environment variables expected:
- BOOKS_TABLE_NAME: DynamoDB table name (e.g. OnlineLibrary)
- UPLOADS_BUCKET_NAME: S3 bucket name for uploads
- UPLOAD_URL_TTL_SECONDS: (optional) TTL for presigned URL, default 900
- MAX_FILE_SIZE_BYTES: (optional) Max file size, default 50MB
- ALLOWED_EXTENSIONS: (optional) Comma-separated extensions, default .pdf,.epub
"""

import base64
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import boto3

# Import from shared utilities (parent directory)
from shared.error_handler import (
    lambda_handler_wrapper,
    api_response,
    ApiError,
    ErrorCode,
)
from shared.validators import (
    validate_required_fields,
    validate_string_field,
    validate_integer_field,
    validate_file_extension,
    validate_file_size,
)
from shared.auth import extract_and_validate_user
from shared.logger import get_logger
from shared.dynamodb import put_draft_book_item
from shared.aws_clients import s3_client

logger = get_logger(__name__)


@dataclass
class CreateUploadPayload:
    file_name: str
    file_size: int
    title: str
    author: str
    description: Optional[str]


def _parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse request body, handling base64 encoding."""
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    try:
        return json.loads(body) if body else {}
    except json.JSONDecodeError:
        raise ApiError( 
            error_code=ErrorCode.INVALID_REQUEST,
            message="Request body must be valid JSON",
        )


def _validate_and_build_payload(data: Dict[str, Any]) -> CreateUploadPayload:
    """Validate and build upload payload from request data."""
    validate_required_fields(data, ["fileName", "fileSize", "title", "author"])

    file_name = validate_string_field(data["fileName"], "fileName", min_length=1)
    title = validate_string_field(data["title"], "title", min_length=1)
    author = validate_string_field(data["author"], "author", min_length=1)

    max_size_bytes = int(os.getenv("MAX_FILE_SIZE_BYTES", str(50 * 1024 * 1024)))
    file_size = validate_integer_field(data["fileSize"], "fileSize", min_value=1)
    validate_file_size(file_size, max_size_bytes)

    allowed_extensions_str = os.getenv("ALLOWED_EXTENSIONS", ".pdf,.epub")
    allowed_extensions = {
        ext.strip().lower() for ext in allowed_extensions_str.split(",") if ext.strip()
    }
    validate_file_extension(file_name, allowed_extensions)

    description = data.get("description")
    if description is not None:
        description = validate_string_field(description, "description", min_length=0)

    return CreateUploadPayload(
        file_name=file_name,
        file_size=file_size,
        title=title,
        author=author,
        description=description,
    )


def _build_s3_key(book_id: str, file_name: str) -> str:
    return f"uploads/{book_id}/{file_name}"


def _create_presigned_put_url(bucket_name, object_key, expires_in):
    return s3_client().generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": bucket_name, "Key": object_key},
        ExpiresIn=expires_in,
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
    AWS Lambda handler for createUploadUrl.

    Expects an API Gateway HTTP API event with Cognito JWT authorizer.
    """
    # 1) Auth
    user_id, user_email = extract_and_validate_user(event)

    # 2) Parse body
    data = _parse_body(event)

    # 3) Validate payload
    payload = _validate_and_build_payload(data)

    # 4) Env config
    table_name = _get_env_or_error("BOOKS_TABLE_NAME")
    bucket_name = _get_env_or_error("UPLOADS_BUCKET_NAME")
    expires_in = int(os.getenv("UPLOAD_URL_TTL_SECONDS", "900"))

    # 5) Build S3 key + DDB item
    book_id = str(uuid.uuid4())
    s3_key = _build_s3_key(book_id, payload.file_name)

    put_draft_book_item(
        table_name=table_name,
        book_id=book_id,
        file_name=payload.file_name,
        file_size=payload.file_size,
        title=payload.title,
        author=payload.author,
        description=payload.description,
        user_id=user_id,
        user_email=user_email,
        s3_key=s3_key,
    )

    # 6) Generate presigned URL
    upload_url = _create_presigned_put_url(
        bucket_name=bucket_name,
        object_key=s3_key,
        expires_in=expires_in,
    )

    # 7) Log action
    logger.info(
        f"Upload URL created for book {book_id}",
        extra={
            "requestId": context.request_id if hasattr(context, "request_id") else "unknown",
            "userId": user_id,
            "action": "CREATE_UPLOAD_URL",
            "status": "SUCCESS",
        },
    )

    # 8) Success response
    return api_response(
        200,
        {
            "uploadUrl": upload_url,
            "bookId": book_id,
            "expiresIn": expires_in,
        },
    )

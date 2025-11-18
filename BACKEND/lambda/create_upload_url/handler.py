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
"""

import base64
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import boto3

from lib.utils.error_handler import (
    lambda_handler_wrapper,
    api_response,
    AppError,
)
from lib.utils.error_codes import ErrorCode


@dataclass
class CreateUploadPayload:
    file_name: str
    file_size: int
    title: str
    author: str
    description: Optional[str]


def _json_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Thin wrapper around api_response so we can inject
    CORS headers in one place if needed.
    """
    response = api_response(status_code=status_code, body=body)
    # NOTE: In production, restrict CORS to the frontend domain.
    response["headers"]["Access-Control-Allow-Origin"] = "*"
    return response


def _get_jwt_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract JWT claims from an API Gateway HTTP API event.
    """
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )


def _parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")  # type: ignore[name-defined]
    try:
        return json.loads(body) if body else {}
    except json.JSONDecodeError:
        raise ValueError("Request body must be valid JSON")


def _validate_and_build_payload(data: Dict[str, Any]) -> CreateUploadPayload:
    try:
        file_name = str(data["fileName"])
        file_size = int(data["fileSize"])
        title = str(data["title"])
        author = str(data["author"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Missing or invalid required fields") from exc

    description = data.get("description")
    if description is not None:
        description = str(description)

    if not file_name:
        raise ValueError("fileName must not be empty")
    if file_size <= 0:
        raise ValueError("fileSize must be positive")

    max_size_bytes = int(os.getenv("MAX_FILE_SIZE_BYTES", str(50 * 1024 * 1024)))
    if file_size > max_size_bytes:
        raise ValueError("File size exceeds maximum allowed limit")

    extension = os.path.splitext(file_name)[1].lower()
    allowed_extensions = os.getenv("ALLOWED_EXTENSIONS", ".pdf,.epub")
    allowed = {ext.strip().lower() for ext in allowed_extensions.split(",") if ext.strip()}
    if extension not in allowed:
        raise ValueError("File extension not allowed")

    return CreateUploadPayload(
        file_name=file_name,
        file_size=file_size,
        title=title,
        author=author,
        description=description,
    )


def _build_s3_key(book_id: str, file_name: str) -> str:
    return f"uploads/{book_id}/{file_name}"


def _put_draft_book_item(
    table_name: str,
    book_id: str,
    payload: CreateUploadPayload,
    user_id: str,
    user_email: Optional[str],
    s3_key: str,
) -> None:
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-southeast-1"
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    now = datetime.now(timezone.utc)
    ttl_seconds = int(
        (now + timedelta(hours=72)).timestamp()
    )  # 72h TTL for auto-cleanup

    item: Dict[str, Any] = {
        "PK": f"BOOK#{book_id}",
        "SK": "METADATA",
        "bookId": book_id,
        "title": payload.title,
        "author": payload.author,
        "description": payload.description,
        "uploaderId": user_id,
        "uploaderEmail": user_email,
        "status": "UPLOADING",
        "fileSize": payload.file_size,
        "s3Key": s3_key,
        "ttl": ttl_seconds,
        "GSI6PK": f"UPLOADER#{user_id}",
        "GSI6SK": f"BOOK#{book_id}",
    }

    # Remove optional fields that might be None
    item = {k: v for k, v in item.items() if v is not None}

    table.put_item(Item=item)


def _create_presigned_put_url(
    bucket_name: str, object_key: str, expires_in: int
) -> str:
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-southeast-1"
    s3 = boto3.client("s3", region_name=region)
    return s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": bucket_name, "Key": object_key},
        ExpiresIn=expires_in,
    )


def _get_env_or_error(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise AppError(
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
    claims = _get_jwt_claims(event)
    if not claims:
        raise AppError(
            error_code=ErrorCode.UNAUTHORIZED,
            message="Missing authentication claims",
        )

    user_id = claims.get("sub")
    user_email = claims.get("email")
    if not user_id:
        raise AppError(
            error_code=ErrorCode.UNAUTHORIZED,
            message="Missing user id in JWT claims",
        )

    # 2) Parse body
    try:
        data = _parse_body(event)
    except ValueError as exc:
        raise AppError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=str(exc) or "Invalid JSON body",
        )

    # 3) Validate payload
    try:
        payload = _validate_and_build_payload(data)
    except ValueError as exc:
        raise AppError(
            error_code=ErrorCode.INVALID_REQUEST,
            message=str(exc),
        )

    # 4) Env config
    table_name = _get_env_or_error("BOOKS_TABLE_NAME")
    bucket_name = _get_env_or_error("UPLOADS_BUCKET_NAME")
    expires_in = int(os.getenv("UPLOAD_URL_TTL_SECONDS", "900"))

    # 5) Build S3 key + DDB item
    book_id = str(uuid.uuid4())
    s3_key = _build_s3_key(book_id, payload.file_name)

    _put_draft_book_item(
        table_name=table_name,
        book_id=book_id,
        payload=payload,
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

    # 7) Success response
    return _json_response(
        200,
        {
            "uploadUrl": upload_url,
            "bookId": book_id,
            "expiresIn": expires_in,
        },
    )

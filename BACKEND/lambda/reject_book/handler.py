"""
reject_book Lambda - Admin rejects a book and moves it to quarantine.

Triggered by POST /admin/books/{bookId}/reject
Body:
{
  "reason": "string"  # optional but recommended
}
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

from shared.logger import get_logger
from shared.dynamodb import get_book_metadata, update_book_status
from shared.aws_clients import s3_client
from shared.error_handler import api_response, build_error_response, ErrorCode

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        # Extract bookId from path or body
        path_book_id = event.get("pathParameters", {}).get("bookId")
        body = json.loads(event.get("body") or "{}")
        body_book_id = body.get("bookId")
        book_id = path_book_id or body_book_id
        if not book_id:
            err = build_error_response(ErrorCode.INVALID_REQUEST, "Missing bookId")
            return api_response(400, err)

        reason = body.get("reason") or "No specific reason provided"

        # Auth info
        claims = (
            event.get("requestContext", {})
            .get("authorizer", {})
            .get("jwt", {})
            .get("claims", {})
        )
        admin_id = claims.get("sub", "unknown")

        # Env
        table_name = _get_env_or_error("BOOKS_TABLE_NAME")
        bucket_name = _get_env_or_error("UPLOADS_BUCKET_NAME")

        # Load book metadata
        book = get_book_metadata(table_name, book_id)
        if not book:
            err = build_error_response(ErrorCode.NOT_FOUND, f"Book {book_id} not found")
            return api_response(404, err)

        # Only reject PENDING
        if book.get("status") != "PENDING":
            err = build_error_response(
                ErrorCode.INVALID_REQUEST,
                f"Book status is {book.get('status')}, expected PENDING",
            )
            return api_response(400, err)

        # Move file from staging/ to quarantine/ (or uploads/ -> quarantine/ as fallback)
        file_path = book.get("file_path") or book.get("s3Key")
        if not file_path:
            err = build_error_response(
                ErrorCode.INTERNAL_ERROR, "Book has no file path"
            )
            return api_response(500, err)

        src_key = file_path
        dest_key = file_path.replace("staging/", "quarantine/").replace("uploads/", "quarantine/")
        s3 = s3_client()
        # If dest already exists (previous attempt), skip copy
        dest_exists = False
        try:
            s3.head_object(Bucket=bucket_name, Key=dest_key)
            dest_exists = True
        except Exception:
            dest_exists = False

        if not dest_exists:
            copy_error = None
            for candidate in (src_key, file_path.replace("staging/", "uploads/")):
                try:
                    s3.copy_object(Bucket=bucket_name, CopySource={"Bucket": bucket_name, "Key": candidate}, Key=dest_key)
                    src_key = candidate
                    copy_error = None
                    break
                except Exception as e:
                    copy_error = e
            if copy_error:
                logger.error(f"Failed to copy object for rejection: {copy_error}")
                err = build_error_response(ErrorCode.INTERNAL_ERROR, "File not found for rejection")
                return api_response(500, err)
            # Delete original only if we copied from it
            try:
                s3.delete_object(Bucket=bucket_name, Key=src_key)
            except Exception:
                pass

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update DynamoDB with rejection info
        # Update DynamoDB with rejection info; avoid setting GSI attributes to NULL
        update_payload = {
            "status": "REJECTED",
            "file_path": dest_key,
            "rejectedAt": now_iso,
            "rejectedBy": admin_id,
            "rejectedReason": reason,
        }
        # If item has pending GSI keys, remove them
        if "GSI5PK" in book or "GSI5SK" in book:
            update_payload["GSI5PK"] = None
            update_payload["GSI5SK"] = None

        update_book_status(
            table_name=table_name,
            book_id=book_id,
            **update_payload,
        )

        logger.info(f"Book {book_id} rejected by {admin_id} with reason: {reason}")

        return api_response(
            200,
            {
                "bookId": book_id,
                "status": "REJECTED",
                "reason": reason,
            },
        )

    except ValueError as e:
        logger.error(f"Config error: {e}")
        err = build_error_response(ErrorCode.INTERNAL_ERROR, "Server configuration error")
        return api_response(500, err)
    except Exception as e:
        logger.error(f"Error rejecting book: {e}", exc_info=True)
        err = build_error_response(ErrorCode.INTERNAL_ERROR, "Internal server error")
        return api_response(500, err)

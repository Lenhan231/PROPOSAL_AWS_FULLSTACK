# validate_mime_type/handler.py
import json
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any

import boto3
import magic  # make sure python-magic (libmagic) is available in Lambda layer
from urllib.parse import unquote_plus

logger = logging.getLogger()
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

# Allowed MIME types (from design)
ALLOWED_MIME = {"application/pdf", "application/epub+zip"}

# DynamoDB table / region
TABLE_NAME = os.getenv("BOOKS_TABLE_NAME", "OnlineLibrary")
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-southeast-1"

# S3 client / DynamoDB resource
s3 = boto3.client("s3", region_name=AWS_REGION)
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_s3_record(record: Dict[str, Any]) -> Dict[str, Any]:
    s3info = record.get("s3", {})
    bucket = s3info.get("bucket", {}).get("name")
    key = s3info.get("object", {}).get("key")
    size = s3info.get("object", {}).get("size")
    # key in event can be URL-encoded
    if key:
        key = unquote_plus(key)
    return {"bucket": bucket, "key": key, "size": size}


def _get_book_id_from_key(key: str) -> str:
    """
    Expect key format: uploads/{bookId}/{filename}
    Returns bookId or raises ValueError
    """
    parts = key.split("/")
    if len(parts) < 3 or parts[0] != "uploads":
        raise ValueError(f"Unexpected S3 key format: {key}")
    return parts[1]


def _download_first_n_bytes(bucket: str, key: str, n: int = 4096) -> bytes:
    """
    Use Range header to download only first n bytes.
    If object is smaller than n, S3 returns whole object.
    """
    try:
        resp = s3.get_object(Bucket=bucket, Key=key, Range=f"bytes=0-{n-1}")
        return resp["Body"].read()
    except s3.exceptions.NoSuchKey:
        raise
    except Exception as exc:
        # Some S3 notifications can be for objects that are not yet fully consistent - bubble up
        raise


def _head_object_size(bucket: str, key: str) -> int:
    resp = s3.head_object(Bucket=bucket, Key=key)
    return int(resp.get("ContentLength", 0))


def _get_metadata_item(book_id: str) -> Dict[str, Any]:
    pk = f"BOOK#{book_id}"
    sk = "METADATA"
    resp = table.get_item(Key={"PK": pk, "SK": sk})
    return resp.get("Item")


def _update_item_set_fields(pk: str, sk: str, set_fields: Dict[str, Any], remove_attrs: list = None) -> None:
    """
    Update DynamoDB item with SET for set_fields and REMOVE for remove_attrs.
    """
    if remove_attrs is None:
        remove_attrs = []

    expr_parts = []
    expr_attr_values = {}
    expr_attr_names = {}

    if set_fields:
        set_clauses = []
        for i, (k, v) in enumerate(set_fields.items()):
            # use attribute names to be safe
            name = f"#f{i}"
            val = f":v{i}"
            expr_attr_names[name] = k
            expr_attr_values[val] = v
            set_clauses.append(f"{name} = {val}")
        expr_parts.append("SET " + ", ".join(set_clauses))

    if remove_attrs:
        remove_clauses = []
        for j, attr in enumerate(remove_attrs):
            # we can directly use attr name if not reserved; keep safe with names
            rname = f"#r{j}"
            expr_attr_names[rname] = attr
            remove_clauses.append(rname)
        expr_parts.append("REMOVE " + ", ".join(remove_clauses))

    update_expression = " ".join(expr_parts)
    if not update_expression:
        logger.info("No update expression to run")
        return

    try:
        table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expr_attr_names or None,
            ExpressionAttributeValues=expr_attr_values or None,
        )
    except Exception:
        logger.exception("DynamoDB update_item failed")
        raise


def _set_pending(book_id: str, uploader_id: str, uploaded_at: str, file_size: int, s3_key: str) -> None:
    pk = f"BOOK#{book_id}"
    sk = "METADATA"
    set_fields = {
        "status": "PENDING",
        "uploadedAt": uploaded_at,
        "fileSize": file_size,
        "s3Key": s3_key,
        "GSI5PK": "STATUS#PENDING",
        "GSI5SK": uploaded_at,
        "GSI6PK": f"UPLOADER#{uploader_id}",
        "GSI6SK": f"BOOK#{book_id}",
    }
    # remove ttl attribute so item won't be TTL-cleaned
    _update_item_set_fields(pk, sk, set_fields, remove_attrs=["ttl"])
    logger.info("Updated item to PENDING for book %s", book_id)


def _set_rejected_invalid_type(book_id: str, uploader_id: str, uploaded_at: str) -> None:
    pk = f"BOOK#{book_id}"
    sk = "METADATA"
    set_fields = {
        "status": "REJECTED_INVALID_TYPE",
        "uploadedAt": uploaded_at,
        "GSI6PK": f"UPLOADER#{uploader_id}",
        "GSI6SK": f"BOOK#{book_id}",
    }
    _update_item_set_fields(pk, sk, set_fields, remove_attrs=["ttl"])
    logger.info("Updated item to REJECTED_INVALID_TYPE for book %s", book_id)


def _delete_s3_object(bucket: str, key: str) -> None:
    try:
        s3.delete_object(Bucket=bucket, Key=key)
        logger.info("Deleted s3://%s/%s", bucket, key)
    except Exception:
        logger.exception("Failed to delete s3 object s3://%s/%s", bucket, key)
        raise


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    S3 ObjectCreated event handler to validate first bytes of uploaded file.
    """
    logger.info("Received event: %s", json.dumps(event))

    records = event.get("Records", [])
    results = []

    for record in records:
        try:
            # Only handle S3 object created events
            parsed = _parse_s3_record(record)
            bucket = parsed["bucket"]
            key = parsed["key"]
            event_size = parsed.get("size")  # may be None

            if not bucket or not key:
                logger.warning("Record missing bucket/key, skipping: %s", record)
                results.append({"key": key, "status": "SKIPPED_NO_KEY"})
                continue

            try:
                book_id = _get_book_id_from_key(key)
            except ValueError as exc:
                logger.warning("Skipping object with unexpected key format: %s (%s)", key, exc)
                results.append({"key": key, "status": "SKIPPED_BAD_KEY"})
                continue

            # Get book metadata to find uploaderId (created by createUploadUrl)
            item = _get_metadata_item(book_id)
            if not item:
                logger.warning("No metadata item found for book %s (key=%s). Skipping", book_id, key)
                results.append({"bookId": book_id, "key": key, "status": "SKIPPED_NO_METADATA"})
                continue

            uploader_id = item.get("uploaderId") or item.get("uploaderId".lower()) or item.get("uploader")  # tolerate variants
            if not uploader_id:
                logger.warning("Metadata for book %s missing uploaderId. Skipping update but will not delete object.", book_id)
                results.append({"bookId": book_id, "key": key, "status": "SKIPPED_NO_UPLOADER"})
                continue

            # Download first 4KB
            try:
                head_bytes = _download_first_n_bytes(bucket, key, n=4096)
            except Exception as exc:
                logger.exception("Failed to download head bytes for s3://%s/%s", bucket, key)
                results.append({"bookId": book_id, "key": key, "status": "ERROR_DOWNLOAD"})
                continue

            # Detect MIME
            try:
                mime_type = magic.from_buffer(head_bytes, mime=True)
            except Exception:
                logger.exception("magic.from_buffer failed for %s", key)
                mime_type = None

            now = _now_iso()

            # best effort get full filesize (from head_object) if available
            try:
                full_size = _head_object_size(bucket, key)
            except Exception:
                full_size = int(event_size) if event_size is not None else None

            logger.info("s3://%s/%s detected mime=%s size=%s", bucket, key, mime_type, full_size)

            if mime_type in ALLOWED_MIME:
                # VALID: set status = PENDING and set GSIs; remove ttl
                _set_pending(book_id=book_id, uploader_id=uploader_id, uploaded_at=now, file_size=full_size or 0, s3_key=key)
                results.append({"bookId": book_id, "key": key, "status": "PENDING", "mime": mime_type})
            else:
                # INVALID: delete S3 object and set status = REJECTED_INVALID_TYPE
                try:
                    _delete_s3_object(bucket, key)
                except Exception:
                    # If delete fails, still try to set metadata to rejected
                    logger.exception("Failed to delete invalid object, continuing to update metadata to REJECTED_INVALID_TYPE")

                _set_rejected_invalid_type(book_id=book_id, uploader_id=uploader_id, uploaded_at=now)
                results.append({"bookId": book_id, "key": key, "status": "REJECTED_INVALID_TYPE", "mime": mime_type})

        except Exception:
            logger.exception("Unhandled exception processing record")
            results.append({"status": "ERROR_UNHANDLED"})

    return {"statusCode": 200, "body": json.dumps({"results": results})}


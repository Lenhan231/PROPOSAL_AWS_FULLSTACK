"""
get_read_url Lambda - Generate CloudFront signed URL for reading books

Triggered by GET /books/{bookId}/read-url
Returns a signed CloudFront URL that expires in 1 hour.

Flow:
1. User authenticated via JWT
2. Check if book exists and is APPROVED
3. Generate CloudFront signed URL
4. Return URL to frontend
5. Frontend uses URL to download file from CloudFront

Environment variables:
- CLOUDFRONT_DOMAIN: CloudFront domain name
- CLOUDFRONT_KEY_PAIR_ID: CloudFront key pair ID
- CLOUDFRONT_PRIVATE_KEY: CloudFront private key (base64 encoded)
- BOOKS_TABLE_NAME: DynamoDB table name
"""

import json
import os
import base64
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from shared.logger import get_logger
from shared.dynamodb import get_book_metadata
from shared.error_handler import api_response, build_error_response, ErrorCode

logger = get_logger(__name__)


def _get_env_or_error(name: str) -> str:
    """Get environment variable or raise error if not set."""
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _generate_signed_url(
    cloudfront_domain: str,
    key_pair_id: str,
    private_key: str,
    book_id: str,
    expiry_hours: int = 1,
) -> str:
    """
    Generate CloudFront signed URL using RSA-SHA1.

    Args:
        cloudfront_domain: CloudFront domain name
        key_pair_id: CloudFront key pair ID
        private_key: CloudFront private key (PEM format)
        book_id: Book ID
        expiry_hours: URL expiry time in hours

    Returns:
        Signed CloudFront URL
    """
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.backends import default_backend
    except ImportError:
        raise ImportError("cryptography library required for CloudFront signing")

    # Construct resource path
    resource_path = f"https://{cloudfront_domain}/public/books/{book_id}/*"

    # Calculate expiry timestamp
    from datetime import timezone
    expiry_time = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)
    expiry_timestamp = int(expiry_time.timestamp())

    # Create policy
    policy = {
        "Statement": [
            {
                "Resource": resource_path,
                "Condition": {
                    "DateLessThan": {
                        "AWS:EpochTime": expiry_timestamp
                    }
                },
            }
        ]
    }

    policy_json = json.dumps(policy, separators=(",", ":"))
    policy_b64 = base64.b64encode(policy_json.encode()).decode()

    # Sign policy
    private_key_obj = serialization.load_pem_private_key(
        private_key.encode(),
        password=None,
        backend=default_backend(),
    )

    signature = private_key_obj.sign(
        policy_b64.encode(),
        padding.PKCS1v15(),
        hashes.SHA1(),
    )
    signature_b64 = base64.b64encode(signature).decode()

    # Build signed URL
    signed_url = (
        f"https://{cloudfront_domain}/public/books/{book_id}/*"
        f"?Policy={policy_b64}"
        f"&Signature={signature_b64}"
        f"&Key-Pair-Id={key_pair_id}"
    )

    return signed_url


def _get_book_file_path(book_id: str, table_name: str) -> Optional[str]:
    """
    Get book file path from DynamoDB.

    Args:
        book_id: Book ID
        table_name: DynamoDB table name

    Returns:
        File path (e.g., public/books/book-123/book.pdf) or None if not found
    """
    try:
        item = get_book_metadata(table_name, book_id)
        if not item:
            return None

        # Check if book is approved
        if item.get("status") != "APPROVED":
            logger.warning(f"Book {book_id} is not approved (status: {item.get('status')})")
            return None

        # Get file path from metadata
        file_path = item.get("file_path")
        if not file_path:
            logger.warning(f"Book {book_id} has no file_path in metadata")
            return None

        return file_path
    except Exception as e:
        logger.error(f"Error getting book metadata: {str(e)}")
        return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for GET /books/{bookId}/read-url

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        Response with signed URL or error
    """
    try:
        # Extract book ID from path
        book_id = event.get("pathParameters", {}).get("bookId")
        if not book_id:
            error_body = build_error_response(
                error_code=ErrorCode.INVALID_REQUEST,
                message="Missing bookId in path",
            )
            return api_response(status_code=400, body=error_body)

        logger.info(f"Generating read URL for book {book_id}")

        # Get environment variables
        cloudfront_domain = _get_env_or_error("CLOUDFRONT_DOMAIN")
        table_name = _get_env_or_error("BOOKS_TABLE_NAME")
        
        # CloudFront credentials (optional - if not provided, return direct S3 URL)
        key_pair_id = os.getenv("CLOUDFRONT_KEY_PAIR_ID")
        private_key_b64 = os.getenv("CLOUDFRONT_PRIVATE_KEY")

        # Check if book exists and is approved
        file_path = _get_book_file_path(book_id, table_name)
        if not file_path:
            error_body = build_error_response(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Book {book_id} not found or not approved",
            )
            return api_response(status_code=404, body=error_body)

        # Generate signed URL
        if key_pair_id and private_key_b64:
            # Use CloudFront signed URL if credentials provided
            try:
                private_key = base64.b64decode(private_key_b64).decode()
            except Exception as e:
                logger.error(f"Error decoding private key: {str(e)}")
                error_body = build_error_response(
                    error_code=ErrorCode.INTERNAL_ERROR,
                    message="Invalid CloudFront private key",
                )
                return api_response(status_code=500, body=error_body)

            signed_url = _generate_signed_url(
                cloudfront_domain=cloudfront_domain,
                key_pair_id=key_pair_id,
                private_key=private_key,
                book_id=book_id,
                expiry_hours=1,
            )
        else:
            # Fallback: Return direct CloudFront URL (no signing)
            logger.warning("CloudFront credentials not provided, returning unsigned URL")
            signed_url = f"https://{cloudfront_domain}/{file_path}"

        logger.info(f"Generated signed URL for book {book_id}")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "bookId": book_id,
                "url": signed_url,
                "expiresIn": 3600,  # 1 hour in seconds
            }),
        }

    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Server configuration error",
        )
        return api_response(status_code=500, body=error_body)
    except Exception as e:
        logger.error(f"Error generating read URL: {str(e)}", exc_info=True)
        error_body = build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Internal server error",
        )
        return api_response(status_code=500, body=error_body)

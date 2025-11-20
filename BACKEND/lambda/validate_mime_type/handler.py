"""
    validate_mime_type Lambda - Hướng dẫn:

    Tạo folder structure:

    BACKEND/lambda/validate_mime_type/
    ├── handler.py
    └── __init__.py
    handler.py cần:

    Nhận S3 event (khi file upload xong)
    Lấy file từ S3
    Check MIME type (dùng python-magic hoặc mimetypes)
    Update DynamoDB status:
    APPROVED nếu MIME type hợp lệ
    REJECTED nếu không hợp lệ
    Move file từ uploads/ → public/books/ (nếu approved)
    Environment variables cần:

    BOOKS_TABLE_NAME
    UPLOADS_BUCKET_NAME
    ALLOWED_MIME_TYPES (ví dụ: application/pdf,application/epub+zip)
    Flow:


    S3 Upload Complete
    → S3 Event → Lambda validate_mime_type
    → Check MIME type
    → Update DynamoDB
    → Move file (nếu approved)
"""


import base64
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional
import magic

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


logger = get_logger(__name__)
mime_type = magic.from_buffer(file__)

@dataclass
class 
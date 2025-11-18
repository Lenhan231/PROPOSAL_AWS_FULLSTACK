import pytest

from validate_mime_type.handler import handler


@pytest.mark.skip(reason="TODO: implement validateMimeType Lambda")
def test_validate_mime_type_valid_pdf(s3_bucket, books_table):
    """
    Skeleton:
    - Put a fake PDF file into uploads/ in S3
    - Seed a draft Book Metadata item with status=UPLOADING + ttl
    - Build an S3 event for that object and call handler
    - Expect:
      - status becomes PENDING
      - ttl removed
      - GSI5PK/5SK and GSI6PK/6SK set as specified in design
    """
    assert True


@pytest.mark.skip(reason="TODO: implement validateMimeType Lambda")
def test_validate_mime_type_invalid_type(s3_bucket, books_table):
    """
    Skeleton:
    - Put a non-PDF/ePub file into uploads/
    - Seed a draft Book Metadata item
    - After handler:
      - S3 object is deleted
      - status becomes REJECTED_INVALID_TYPE
      - ttl removed
      - GSI6PK/6SK kept so user still sees item in my-uploads
    """
    assert True

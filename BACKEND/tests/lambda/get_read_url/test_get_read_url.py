import pytest

from get_read_url.handler import handler


@pytest.mark.skip(reason="TODO: implement getReadUrl Lambda")
def test_get_read_url_happy_path(upload_test_context, books_table):
    """
    Skeleton:
    - Seed an APPROVED book item in DynamoDB with s3Key pointing to public/books/
    - Call handler with JWT of a normal user and that bookId
    - Expect:
      - statusCode 200
      - body contains readUrl + expiresIn
      - readUrl looks like a CloudFront signed URL
    """
    assert True


@pytest.mark.skip(reason="TODO: implement getReadUrl Lambda")
def test_get_read_url_forbidden_when_not_approved(upload_test_context, books_table):
    """
    Skeleton:
    - Seed book with status=PENDING
    - Expect 403 and appropriate errorCode when requesting readUrl
    """
    assert True

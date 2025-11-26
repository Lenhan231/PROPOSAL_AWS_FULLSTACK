import pytest

from get_my_uploads.handler import handler


@pytest.mark.skip(reason="TODO: implement getMyUploads Lambda")
def test_get_my_uploads_happy_path(upload_test_context, books_table):
    """
    Skeleton:
    - Seed multiple book items for the same uploader with different statuses
    - Call handler with JWT for that user
    - Expect:
      - statusCode 200
      - only that user's uploads returned
      - ordered by uploadedAt desc
    """
    assert True

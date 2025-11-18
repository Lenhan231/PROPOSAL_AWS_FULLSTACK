import pytest

from list_pending_books.handler import handler


@pytest.mark.skip(reason="TODO: implement listPendingBooks Lambda")
def test_list_pending_books_happy_path(upload_test_context, books_table):
    """
    Skeleton:
    - Seed multiple PENDING book items with GSI5PK=STATUS#PENDING
    - Call handler as admin with page/pageSize
    - Expect:
      - statusCode 200
      - data sorted by uploadedAt desc
      - each item has correct uploader/email/fileSize
    """
    assert True

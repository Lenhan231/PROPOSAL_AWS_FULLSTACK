import pytest

from search_books.handler import handler


@pytest.mark.skip(reason="TODO: implement searchBooks Lambda")
def test_search_books_by_title(upload_test_context, books_table):
    """
    Skeleton:
    - Seed APPROVED books with GSI1PK=TITLE#normalized
    - Call handler with title query
    - Expect:
      - statusCode 200
      - only APPROVED books with matching title returned
    """
    assert True


@pytest.mark.skip(reason="TODO: implement searchBooks Lambda")
def test_search_books_invalid_when_both_title_and_author(upload_test_context):
    """
    Skeleton:
    - Call handler with both title and author query params
    - Expect 400 INVALID_REQUEST
    """
    assert True

import json
import sys
from pathlib import Path
from typing import Any, Dict

import boto3
import pytest

# Add lambda directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from search_books.handler import handler


@pytest.fixture
def search_books_context(monkeypatch, aws_region, books_table):
    """Setup for search_books tests."""
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("BOOKS_TABLE_NAME", books_table.table_name)

    return {
        "region": aws_region,
        "table_name": books_table.table_name,
    }


def test_search_books_empty(search_books_context):
    """Test search with no books."""
    # Create API Gateway event
    event = {
        "queryStringParameters": {
            "q": "test",
        },
    }

    # Call handler
    response = handler(event, context={})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["books"] == []
    assert body["pagination"]["total"] == 0


def test_search_books_by_title(search_books_context, books_table):
    """Test searching books by title."""
    table_name = search_books_context["table_name"]
    
    # Create approved books in DynamoDB
    ddb_resource = boto3.resource("dynamodb", region_name=search_books_context["region"])
    table = ddb_resource.Table(table_name)
    
    books_data = [
        {
            "PK": "BOOK#book-1",
            "SK": "METADATA",
            "bookId": "book-1",
            "title": "Python Programming",
            "author": "John Doe",
            "status": "APPROVED",
        },
        {
            "PK": "BOOK#book-2",
            "SK": "METADATA",
            "bookId": "book-2",
            "title": "JavaScript Guide",
            "author": "Jane Smith",
            "status": "APPROVED",
        },
        {
            "PK": "BOOK#book-3",
            "SK": "METADATA",
            "bookId": "book-3",
            "title": "Python Web Development",
            "author": "Bob Johnson",
            "status": "APPROVED",
        },
    ]
    
    for book in books_data:
        table.put_item(Item=book)
    
    # Search for "Python"
    event = {
        "queryStringParameters": {
            "q": "Python",
        },
    }
    
    response = handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["books"]) == 2
    assert body["pagination"]["total"] == 2
    
    # Verify results
    titles = [book["title"] for book in body["books"]]
    assert "Python Programming" in titles
    assert "Python Web Development" in titles


def test_search_books_by_author(search_books_context, books_table):
    """Test searching books by author."""
    table_name = search_books_context["table_name"]
    
    # Create approved books
    ddb_resource = boto3.resource("dynamodb", region_name=search_books_context["region"])
    table = ddb_resource.Table(table_name)
    
    table.put_item(Item={
        "PK": "BOOK#book-1",
        "SK": "METADATA",
        "bookId": "book-1",
        "title": "Book One",
        "author": "John Doe",
        "status": "APPROVED",
    })
    
    table.put_item(Item={
        "PK": "BOOK#book-2",
        "SK": "METADATA",
        "bookId": "book-2",
        "title": "Book Two",
        "author": "Jane Smith",
        "status": "APPROVED",
    })
    
    # Search for "John"
    event = {
        "queryStringParameters": {
            "q": "John",
        },
    }
    
    response = handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["books"]) == 1
    assert body["books"][0]["author"] == "John Doe"


def test_search_books_pagination(search_books_context, books_table):
    """Test pagination."""
    table_name = search_books_context["table_name"]
    
    # Create 5 approved books
    ddb_resource = boto3.resource("dynamodb", region_name=search_books_context["region"])
    table = ddb_resource.Table(table_name)
    
    for i in range(5):
        table.put_item(Item={
            "PK": f"BOOK#book-{i}",
            "SK": "METADATA",
            "bookId": f"book-{i}",
            "title": f"Book {i}",
            "author": "Test Author",
            "status": "APPROVED",
        })
    
    # Get first page (limit=2)
    event = {
        "queryStringParameters": {
            "limit": "2",
            "offset": "0",
        },
    }
    
    response = handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["books"]) == 2
    assert body["pagination"]["total"] == 5
    assert body["pagination"]["hasMore"] is True
    
    # Get second page
    event["queryStringParameters"]["offset"] = "2"
    response = handler(event, context={})
    body = json.loads(response["body"])
    assert len(body["books"]) == 2
    assert body["pagination"]["hasMore"] is True
    
    # Get last page
    event["queryStringParameters"]["offset"] = "4"
    response = handler(event, context={})
    body = json.loads(response["body"])
    assert len(body["books"]) == 1
    assert body["pagination"]["hasMore"] is False


def test_search_books_only_approved(search_books_context, books_table):
    """Test that only approved books are returned."""
    table_name = search_books_context["table_name"]
    
    # Create approved and non-approved books
    ddb_resource = boto3.resource("dynamodb", region_name=search_books_context["region"])
    table = ddb_resource.Table(table_name)
    
    table.put_item(Item={
        "PK": "BOOK#book-1",
        "SK": "METADATA",
        "bookId": "book-1",
        "title": "Approved Book",
        "author": "Test Author",
        "status": "APPROVED",
    })
    
    table.put_item(Item={
        "PK": "BOOK#book-2",
        "SK": "METADATA",
        "bookId": "book-2",
        "title": "Rejected Book",
        "author": "Test Author",
        "status": "REJECTED",
    })
    
    table.put_item(Item={
        "PK": "BOOK#book-3",
        "SK": "METADATA",
        "bookId": "book-3",
        "title": "Uploading Book",
        "author": "Test Author",
        "status": "UPLOADING",
    })
    
    # Search all
    event = {
        "queryStringParameters": {},
    }
    
    response = handler(event, context={})
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["books"]) == 1
    assert body["books"][0]["title"] == "Approved Book"

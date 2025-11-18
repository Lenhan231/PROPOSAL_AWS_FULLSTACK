import json
import boto3

from   reject_book.handler import handler

def test_reject_book_happy_path(reject_book_test_context):
    region = 
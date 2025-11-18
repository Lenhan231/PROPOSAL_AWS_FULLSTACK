import os
from typing import Any, Dict

import boto3
import pytest
from moto import mock_aws

# Aws Mock Stack
@pytest.fixture
def aws_region() -> str:
    """
    Default AWS region for tests.

    Can be overridden via AWS_REGION env if needed.
    """
    return os.getenv("AWS_REGION", "ap-southeast-1")


@pytest.fixture
def moto_backend(aws_region):
    """
    Shared moto backend for all AWS services in a test.
    Ensures S3, DynamoDB, etc. are mocked together.
    """
    with mock_aws():
        yield


@pytest.fixture
def s3_bucket(moto_backend, aws_region) -> Dict[str, Any]:
    """
    Create a test S3 bucket and basic prefixes.
    """
    s3 = boto3.client("s3", region_name=aws_region)
    bucket_name = "test-uploads-bucket"

    if aws_region == "us-east-1":
        s3.create_bucket(Bucket=bucket_name)
    else:
        s3.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": aws_region},
        )

    for prefix in ("uploads/", "public/books/", "quarantine/"):
        s3.put_object(Bucket=bucket_name, Key=prefix)

    return {"client": s3, "bucket_name": bucket_name, "region": aws_region}


@pytest.fixture
def books_table(moto_backend, aws_region):
    """
    Create the OnlineLibrary DynamoDB table with GSIs.
    """
    dynamodb = boto3.client("dynamodb", region_name=aws_region)
    table_name = "OnlineLibrary"

    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
            {"AttributeName": "GSI2PK", "AttributeType": "S"},
            {"AttributeName": "GSI2SK", "AttributeType": "S"},
            {"AttributeName": "GSI3PK", "AttributeType": "S"},
            {"AttributeName": "GSI3SK", "AttributeType": "S"},
            {"AttributeName": "GSI5PK", "AttributeType": "S"},
            {"AttributeName": "GSI5SK", "AttributeType": "S"},
            {"AttributeName": "GSI6PK", "AttributeType": "S"},
            {"AttributeName": "GSI6SK", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
        GlobalSecondaryIndexes=[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI2",
                "KeySchema": [
                    {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI2SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI3",
                "KeySchema": [
                    {"AttributeName": "GSI3PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI3SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI5",
                "KeySchema": [
                    {"AttributeName": "GSI5PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI5SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "GSI6",
                "KeySchema": [
                    {"AttributeName": "GSI6PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI6SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    )

    return boto3.resource("dynamodb", region_name=aws_region).Table(table_name)

def _set_lambda_common_env(
    monkeypatch: pytest.MonkeyPatch,
    aws_region: str,
    bucket_name: str,
    table_name: str,
) -> None:
    """
    Helper to configure common Lambda environment variables.

    Reuse this helper from other fixtures/tests that need the same
    environment (e.g. validateMimeType, approveBook, getReadUrl).
    """
    monkeypatch.setenv("AWS_REGION", aws_region)
    monkeypatch.setenv("UPLOAD_URL_TTL_SECONDS", "900")
    monkeypatch.setenv("UPLOADS_BUCKET_NAME", bucket_name)
    monkeypatch.setenv("BOOKS_TABLE_NAME", table_name)


# Testing function for each lambda
@pytest.fixture
def upload_test_context(
    monkeypatch, aws_region, s3_bucket, books_table
) -> Dict[str, Any]:
    """
    High-level context specifically for upload-related Lambdas.

    Other tests (validateMimeType, approveBook, etc.) can reuse the
    lower-level fixtures `s3_bucket` and `books_table` directly.
    """
    _set_lambda_common_env(
        monkeypatch=monkeypatch,
        aws_region=aws_region,
        bucket_name=s3_bucket["bucket_name"],
        table_name=books_table.table_name,
    )

    return {
        "region": aws_region,
        "bucket_name": s3_bucket["bucket_name"],
        "table_name": books_table.table_name,
    }




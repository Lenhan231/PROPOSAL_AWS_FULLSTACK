import os
from typing import Dict, Any

import boto3
import pytest
from moto import mock_aws

@pytest.fixture
def aws_env(monkeypatch):
    monkeypatch.setenv("AWS_REGION", "ap-southeast-1")
    monkeypatch.setenv("UPLOAD_URL_TTL_SECONDS", "900")
    yield


@pytest.fixture
@mock_aws
def dynamodb_test(monkeypatch, aws_env):
    dynamodb = boto3.client("dynamodb", region_name="ap-southeast-1")
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

    # set env for Lambda handlers
    monkeypatch.setenv("BOOKS_TABLE_NAME", table_name)

    # return Table resource (not client)
    return boto3.resource("dynamodb", region_name="ap-southeast-1").Table(table_name)

@pytest.fixture
@mock_aws
def s3_test(monkeypatch, aws_env):
    region = os.getenv("AWS_REGION", "ap-southeast-1")
    bucket_name = "test-uploads-bucket"

    s3 = boto3.client("s3", region_name=region)

    # S3 create bucket — phải khác nếu không phải us-east-1
    if region == "us-east-1":
        s3.create_bucket(Bucket=bucket_name)
    else:
        s3.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": region},
        )

    # Set env cho Lambda
    monkeypatch.setenv("UPLOADS_BUCKET_NAME", bucket_name)

    # Create expected folder structure
    prefixes = [
        "uploads/",
        "public/books/",
        "quarantine/"
    ]

    for prefix in prefixes:
        s3.put_object(Bucket=bucket_name, Key=prefix)  # zero-byte folder objects

    return {
        "client": s3,
        "bucket": bucket_name,
        "region": region
    }
    

@pytest.fixture
def aws_region() -> str:
    """
    Default AWS region for tests.

    Can be overridden via AWS_REGION env if needed.
    """
    return os.getenv("AWS_REGION", "ap-southeast-1")


@pytest.fixture
def upload_test_context(aws_env, aws_region) -> Dict[str, Any]:
    """
    Shared fixture for Lambda upload-related tests.

    - Spins up moto mocks for S3 and DynamoDB
    - Creates the uploads bucket
    - Creates the OnlineLibrary DynamoDB table
    - Exposes basic context (region, bucket, table) for tests
    """
    with mock_aws():
        s3 = boto3.client("s3", region_name=aws_region)
        dynamodb = boto3.client("dynamodb", region_name=aws_region)

        bucket_name = "test-uploads-bucket"
        table_name = "OnlineLibrary"

        if aws_region == "us-east-1":
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": aws_region},
            )

        dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        monkeypatch.setenv("AWS_REGION", aws_region)
        monkeypatch.setenv("UPLOADS_BUCKET_NAME", bucket_name)
        monkeypatch.setenv("BOOKS_TABLE_NAME", table_name)
        monkeypatch.setenv("UPLOAD_URL_TTL_SECONDS", "900")

        yield {
            "region": aws_region,
            "bucket_name": bucket_name,
            "table_name": table_name,
        }

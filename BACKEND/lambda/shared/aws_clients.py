"""
Shared AWS clients for Lambda functions.

Provides singleton instances of S3 and DynamoDB clients.
"""

import boto3
import os

REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-southeast-1"

# Singleton instances
_s3_client = boto3.client("s3", region_name=REGION)
_dynamodb_resource = boto3.resource("dynamodb", region_name=REGION)


def s3_client():
    """Get S3 client instance."""
    return _s3_client


def dynamodb_resource():
    """Get DynamoDB resource instance."""
    return _dynamodb_resource


__all__ = ["s3_client", "dynamodb_resource"]

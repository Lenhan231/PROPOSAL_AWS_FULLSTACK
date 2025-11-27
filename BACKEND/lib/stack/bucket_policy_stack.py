"""
BucketPolicyStack - Manage bucket policies to avoid cyclic dependencies

Tách riêng bucket policy để tránh circular dependency giữa StorageStack và CdnStack.
StorageStack tạo bucket, CdnStack tạo distribution, BucketPolicyStack thêm policy.
"""

from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_iam as iam,
    Fn,
)
from constructs import Construct


class BucketPolicyStack(Stack):
    """Stack for managing S3 bucket policies"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        storage_stack_name=None,
        cdn_stack_name=None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Import bucket by name from StorageStack export
        if storage_stack_name:
            bucket_name = Fn.import_value(f"{storage_stack_name}-Bucket-Name")
            bucket = s3.Bucket.from_bucket_name(self, "S3Bucket", bucket_name)
        else:
            raise ValueError("storage_stack_name is required")

        # Note: OAC (Origin Access Control) automatically handles bucket policy
        # CloudFront will add the necessary policy when distribution is created
        # No manual policy needed for OAC

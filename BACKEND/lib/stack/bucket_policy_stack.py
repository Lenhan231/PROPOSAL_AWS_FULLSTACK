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

        # Import distribution ID from CdnStack export
        if cdn_stack_name:
            distribution_id = Fn.import_value(f"{cdn_stack_name}-Distribution-Id")
            
            # Add CloudFront policy to bucket
            bucket.add_to_resource_policy(
                iam.PolicyStatement(
                    actions=["s3:GetObject"],
                    resources=[bucket.arn_for_objects("public/books/*")],
                    principals=[iam.ServicePrincipal("cloudfront.amazonaws.com")],
                    conditions={
                        "StringEquals": {
                            "AWS:SourceArn": f"arn:aws:cloudfront::{self.account}:distribution/{distribution_id}"
                        }
                    }
                )
            )

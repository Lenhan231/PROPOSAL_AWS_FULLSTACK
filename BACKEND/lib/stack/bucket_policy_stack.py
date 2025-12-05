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

        # Allow CloudFront (via OAC) to read from the bucket
        if not cdn_stack_name:
            raise ValueError("cdn_stack_name is required")

        distribution_id = Fn.import_value(f"{cdn_stack_name}-Distribution-Id")

        allow_cf_statement = iam.PolicyStatement(
            sid="AllowCloudFrontReadViaOAC",
            effect=iam.Effect.ALLOW,
            principals=[iam.ServicePrincipal("cloudfront.amazonaws.com")],
            actions=["s3:GetObject"],
            resources=[f"{bucket.bucket_arn}/*"],
            conditions={
                "StringEquals": {
                    "AWS:SourceArn": f"arn:aws:cloudfront::{self.account}:distribution/{distribution_id}"
                }
            },
        )

        # Explicit bucket policy resource (imported bucket doesn't auto-create policy)
        s3.CfnBucketPolicy(
            self,
            "BucketPolicy",
            bucket=bucket.bucket_name,
            policy_document=iam.PolicyDocument(statements=[allow_cf_statement]).to_json(),
        )

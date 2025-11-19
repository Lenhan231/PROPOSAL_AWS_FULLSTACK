"""
Phase 1 - Task #4: StorageStack

Mục đích: Nơi chứa file upload + event trigger validate

Components:
- S3 Bucket chính với folder structure:
  * uploads/: Pending files (chờ validate)
  * public/books/: Approved files (serve qua CloudFront)
  * quarantine/: Rejected/takedown files
- Lifecycle Rule: Auto-delete files trong uploads/ sau 72h
- Event Notification: Upload → trigger Lambda validateMimeType
- Security: Block all public access, versioning enabled

Outputs:
- BucketName: Tên của S3 bucket
- BucketArn: ARN của bucket

Dependencies: Tách biệt → Nhưng event notification cần Lambda ARN
              Tạm để placeholder, sẽ wire lại sau khi có Lambda
"""

from aws_cdk import (
    Stack,
    aws_s3 as s3,
    CfnOutput,
    RemovalPolicy,
    Duration,
)
from constructs import Construct


class StorageStack(Stack):
    """Stack for S3 bucket"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        bucket = s3.Bucket(
            self,
            "S3Bucket",
            versioned=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.DESTROY,  # DEV: DESTROY, PROD: RETAIN
            auto_delete_objects=True,
        )

        # === LIFECYCLE: Auto-delete uploads/ after 72h ===
        bucket.add_lifecycle_rule(
            id="UploadsAutoCleanup",
            prefix="uploads/",
            expiration=Duration.hours(72),
        )

        # Placeholder event — sẽ connect Lambda sau
        # bucket.add_event_notification(
        #     s3.EventType.OBJECT_CREATED,
        #     s3n.LambdaDestination(lambda_fn),
        #     prefix="uploads/"
        # )

        # === OUTPUTS ===
        CfnOutput(
            self,
            "BucketName",
            value=bucket.bucket_name,
            export_name=f"{construct_id}-Bucket-Name",
        )

        CfnOutput(
            self,
            "BucketArn",
            value=bucket.bucket_arn,
            export_name=f"{construct_id}-Bucket-Arn",
        )

        # Property for other stacks to reference
        self.bucket = bucket

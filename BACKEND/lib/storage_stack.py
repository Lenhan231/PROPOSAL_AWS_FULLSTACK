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
    RemovalPolicy
)
from constructs import Construct


class StorageStack(Stack):
    """Stack for S3 bucket"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Implement S3 bucket in Task 4
        # This is a placeholder for the stack structure
        
        # Placeholder property (will be implemented in Task 4)
        self.bucket = None
        
        # Outputs
        CfnOutput(
            self,
            "BucketName",
            value="TODO-TASK-4",
            description="S3 bucket name",
            export_name=f"{construct_id}-Bucket-Name"
        )
        
        CfnOutput(
            self,
            "BucketArn",
            value="TODO-TASK-4",
            description="S3 bucket ARN",
            export_name=f"{construct_id}-Bucket-Arn"
        )

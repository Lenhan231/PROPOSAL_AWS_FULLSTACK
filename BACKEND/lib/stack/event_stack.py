"""
EventStack - S3 event notifications and triggers

This stack creates S3 event notifications to trigger Lambda functions.
It references both StorageStack (S3 bucket) and ProcessingStack (Lambda functions)
without creating cyclic dependencies.

Flow:
1. File uploaded to S3 (StorageStack)
2. S3 event triggers Lambda (EventStack)
3. Lambda processes file (ProcessingStack)
"""

from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_s3_notifications as s3n,
    aws_lambda as _lambda,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct


class EventStack(Stack):
    """Stack for S3 event notifications and Lambda triggers"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        storage_stack=None,
        processing_stack=None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        if not storage_stack or not processing_stack:
            raise ValueError("Both storage_stack and processing_stack are required")

        # Get S3 bucket and Lambda function
        bucket = storage_stack.bucket
        validate_mime_type_fn = processing_stack.validate_mime_type_fn

        # Grant S3 permissions to Lambda (read/write for file movement)
        bucket.grant_read_write(validate_mime_type_fn)

        # Grant Lambda permission to be invoked by S3
        validate_mime_type_fn.add_permission(
            "AllowS3Invoke",
            principal=iam.ServicePrincipal("s3.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_account=self.account,
            source_arn=bucket.bucket_arn,
        )

        # Add S3 event notification
        bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.LambdaDestination(validate_mime_type_fn),
            s3.NotificationKeyFilter(prefix="uploads/"),
        )

        # === Outputs ===
        CfnOutput(
            self,
            "S3EventNotificationStatus",
            value="Configured",
            description="S3 event notification for validate_mime_type Lambda",
        )

        CfnOutput(
            self,
            "EventTrigger",
            value=f"s3://{bucket.bucket_name}/uploads/* → {validate_mime_type_fn.function_name}",
            description="S3 to Lambda event trigger mapping",
        )

"""
ProcessingStack - File processing Lambda functions

Separate stack for file processing to avoid cyclic dependencies:
- StorageStack: S3 bucket
- ProcessingStack: validate_mime_type Lambda
- EventStack: S3 event notification (references both)

This allows clean separation of concerns and proper dependency management.
"""

from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct


class ProcessingStack(Stack):
    """Stack for file processing Lambda functions"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        database_stack=None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Get DynamoDB table from database stack
        books_table = database_stack.table if database_stack else None

        # === validate_mime_type Lambda ===
        validate_mime_type_fn = _lambda.Function(
            self,
            "ValidateMimeTypeFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="validate_mime_type.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(60),
            memory_size=512,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "ALLOWED_MIME_TYPES": "application/pdf,application/epub+zip",
            },
        )

        # Grant DynamoDB permissions
        if books_table:
            books_table.grant_write_data(validate_mime_type_fn)

        # Note: S3 permissions will be granted by EventStack or setup script
        # to avoid cyclic dependencies

        # Store Lambda for other stacks to reference
        self.validate_mime_type_fn = validate_mime_type_fn

        # === Outputs ===
        CfnOutput(
            self,
            "ValidateMimeTypeFnArn",
            value=validate_mime_type_fn.function_arn,
            export_name=f"{construct_id}-ValidateMimeType-Arn",
        )

        CfnOutput(
            self,
            "ValidateMimeTypeFnName",
            value=validate_mime_type_fn.function_name,
            export_name=f"{construct_id}-ValidateMimeType-Name",
        )

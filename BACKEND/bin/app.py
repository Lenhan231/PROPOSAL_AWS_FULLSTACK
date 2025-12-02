#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Change to BACKEND directory
os.chdir(Path(__file__).parent.parent)

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import aws_cdk as cdk
from lib.stack.cognito_stack import CognitoStack
from lib.stack.database_stack import DatabaseStack
from lib.stack.storage_stack import StorageStack
from lib.stack.cdn_stack import CdnStack
from lib.stack.bucket_policy_stack import BucketPolicyStack
from lib.stack.api_stack import ApiStack
from lib.stack.processing_stack import ProcessingStack
from lib.stack.monitoring_stack import MonitoringStack

app = cdk.App()

# Get environment from context or default to 'dev'
env_name = app.node.try_get_context("env") or "dev"

# Get CORS origins from context
# Priority: CLI context > cdk.context.json > defaults
cors_origins_str = app.node.try_get_context("cors_origins")
if not cors_origins_str:
    # Try to get from environment-specific config in cdk.context.json
    env_config = app.node.try_get_context(env_name) or {}
    cors_origins_str = env_config.get("cors_origins")

cors_origins = None
if cors_origins_str:
    cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

# AWS environment configuration
env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION", "ap-southeast-1")
)

# Stack name prefix
stack_prefix = f"OnlineLibrary-{env_name}"

# Phase 2: DatabaseStack (create first for Cognito to reference)
database_stack = DatabaseStack(
    app,
    f"{stack_prefix}-Database",
    env=env,
    description="Database for Books metadata"
)

# Phase 1: CognitoStack
cognito_stack = CognitoStack(
    app,
    f"{stack_prefix}-Cognito",
    database_stack=database_stack,
    env=env,
    description="Cognito User Pool for authentication"
)

# Phase 3: StorageStack
storage_stack = StorageStack(
    app,
    f"{stack_prefix}-Storage",
    cors_origins=cors_origins,
    env=env,
    description="S3 bucket for file uploads"
)

# Phase 4: CdnStack
cdn_stack = CdnStack(
    app,
    f"{stack_prefix}-Cdn",
    storage_stack_name=f"{stack_prefix}-Storage",
    env=env,
    description="CloudFront CDN for serving books"
)

# Phase 4b: BucketPolicyStack
bucket_policy_stack = BucketPolicyStack(
    app,
    f"{stack_prefix}-BucketPolicy",
    storage_stack_name=f"{stack_prefix}-Storage",
    cdn_stack_name=f"{stack_prefix}-Cdn",
    env=env,
    description="Bucket policies for S3 and CloudFront"
)

# Phase 5: ApiStack
api_stack = ApiStack(
    app,
    f"{stack_prefix}-Api",
    cognito_stack=cognito_stack,
    database_stack=database_stack,
    storage_stack=storage_stack,
    cdn_stack=cdn_stack,
    env=env,
    description="HTTP API + Lambda for Online Library",
)

# Phase 5b: ProcessingStack (file processing Lambda functions)
processing_stack = ProcessingStack(
    app,
    f"{stack_prefix}-Processing",
    database_stack=database_stack,
    storage_stack_name=f"{stack_prefix}-Storage",
    env=env,
    description="File processing Lambda functions",
)

# Phase 5c: EventStack (S3 event notifications)
# Note: S3 event notification will be created via script to avoid cyclic dependencies
# event_stack = EventStack(
#     app,
#     f"{stack_prefix}-Event",
#     storage_stack=storage_stack,
#     processing_stack=processing_stack,
#     env=env,
#     description="S3 event notifications and Lambda triggers",
# )

# Phase 6: MonitoringStack
monitoring_stack = MonitoringStack(
    app,
    f"{stack_prefix}-Monitoring",
    api_stack=api_stack,
    database_stack=database_stack,
    storage_stack=storage_stack,
    env=env,
    description="CloudWatch monitoring and alarms",
)


# Apply tags
for stack in [cognito_stack, database_stack, storage_stack, cdn_stack, bucket_policy_stack, api_stack, processing_stack, monitoring_stack]:
    cdk.Tags.of(stack).add("Project", "OnlineLibrary")
    cdk.Tags.of(stack).add("Environment", env_name)
    cdk.Tags.of(stack).add("ManagedBy", "CDK")


app.synth()

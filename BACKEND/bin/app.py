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
from lib.stack.api_stack import ApiStack

app = cdk.App()

# Get environment from context or default to 'dev'
env_name = app.node.try_get_context("env") or "dev"

# AWS environment configuration
env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION", "ap-southeast-1")
)

# Stack name prefix
stack_prefix = f"OnlineLibrary-{env_name}"

# Phase 1: CognitoStack
cognito_stack = CognitoStack(
    app,
    f"{stack_prefix}-Cognito",
    env=env,
    description="Cognito User Pool for authentication"
)

# Phase 2: DatabaseStack
database_stack = DatabaseStack(
    app,
    f"{stack_prefix}-Database",
    env=env,
    description="Database for Books metadata"
)

# Phase 3: StorageStack
storage_stack = StorageStack(
    app,
    f"{stack_prefix}-Storage",
    env=env,
    description="S3 bucket for file uploads"
)

# Phase 4: CdnStack
cdn_stack = CdnStack(
    app,
    f"{stack_prefix}-Cdn",
    storage_stack=storage_stack,
    env=env,
    description="CloudFront CDN for serving books"
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


# Apply tags
for stack in [cognito_stack, database_stack, storage_stack, cdn_stack, api_stack]:
    cdk.Tags.of(stack).add("Project", "OnlineLibrary")
    cdk.Tags.of(stack).add("Environment", env_name)
    cdk.Tags.of(stack).add("ManagedBy", "CDK")


app.synth()

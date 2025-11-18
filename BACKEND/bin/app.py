#!/usr/bin/env python3
import sys
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import aws_cdk as cdk
from lib.stack.cognito_stack import CognitoStack

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

# Phase 1: CognitoStack only (for now)
cognito_stack = CognitoStack(
    app,
    f"{stack_prefix}-Cognito",
    env=env,
    description="Cognito User Pool for authentication"
)

# Apply tags
cdk.Tags.of(cognito_stack).add("Project", "OnlineLibrary")
cdk.Tags.of(cognito_stack).add("Environment", env_name)
cdk.Tags.of(cognito_stack).add("ManagedBy", "CDK")

app.synth()

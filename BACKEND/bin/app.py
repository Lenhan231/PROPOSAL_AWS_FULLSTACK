#!/usr/bin/env python3
"""
CDK App Entry Point for Online Library Backend
"""

import os
import aws_cdk as cdk
from lib.stack.cognito_stack import CognitoStack
from lib.stack.database_stack import DatabaseStack
from lib.stack.storage_stack import StorageStack
from lib.stack.cdn_stack import CdnStack
from lib.stack.api_stack import ApiStack
from lib.stack.monitoring_stack import MonitoringStack

app = cdk.App()
# Get environment from context or default to 'dev'

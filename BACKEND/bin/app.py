#!/usr/bin/env python3
"""
CDK App Entry Point for Online Library Backend
"""

import os
import aws_cdk as cdk
from lib.cognito_stack import CognitoStack
from lib.database_stack import DatabaseStack
from lib.storage_stack import StorageStack
from lib.cdn_stack import CdnStack
from lib.api_stack import ApiStack
from lib.monitoring_stack import MonitoringStack

app = cdk.App()
# Get environment from context or default to 'dev'

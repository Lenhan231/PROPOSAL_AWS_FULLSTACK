"""
Phase 6 - Task #17: MonitoringStack

Mục đích: Giám sát hệ thống + alert khi có vấn đề

Components:
- CloudWatch Logs: Retention 14 days cho tất cả Lambda
- CloudWatch Alarms:
  * Lambda error rate > 5%
  * API Gateway 4xx errors > 10 in 5 min
  * API Gateway 5xx errors > 5 in 5 min
  * DynamoDB throttled requests > 0
- SNS Topic: Gửi notifications khi alarm trigger
- AWS Budget Alerts:
  * Warning: cost > $10/month
  * Critical: cost > $20/month

Outputs:
- SnsTopicArn: SNS topic ARN for alarm notifications

Dependencies: Cần API và Lambda functions từ ApiStack
"""

from aws_cdk import (
    Stack,
    aws_cloudwatch as cloudwatch,
    aws_apigatewayv2 as apigw,
    aws_dynamodb as dynamodb,
    aws_lambda as lambda_,
    CfnOutput
)
from constructs import Construct
from typing import List


class MonitoringStack(Stack):
    """Stack for CloudWatch monitoring and alarms"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        api: apigw.IHttpApi = None,
        table: dynamodb.ITable = None,
        lambda_functions: List[lambda_.IFunction] = None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Implement CloudWatch alarms in Task 17
        # This is a placeholder for the stack structure
        
        # Outputs
        CfnOutput(
            self,
            "SnsTopicArn",
            value="TODO-TASK-17",
            description="SNS topic ARN for alarm notifications",
            export_name=f"{construct_id}-SnsTopic-Arn"
        )
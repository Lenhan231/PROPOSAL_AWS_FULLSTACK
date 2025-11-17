"""
Phase 2-4 - Tasks #6-16: ApiStack

Mục đích: API Gateway + 8 Lambda functions cho business logic

Components:
- API Gateway HTTP API (không phải REST API - rẻ hơn)
- JWT Authorizer: Validate token từ Cognito
- 8 Lambda Functions:
  * createUploadUrl (Task 6)
  * validateMimeType (Task 7)
  * listPendingBooks (Task 8)
  * approveBook (Task 9)
  * rejectBook (Task 10)
  * getReadUrl (Task 11)
  * searchBooks (Task 12)
  * getMyUploads (Task 13)
- IAM Roles: Least privilege cho từng Lambda (Task 16)
- CORS: Chỉ allow frontend domain
- Throttling: 1000 req/s burst, 500 req/s steady

Outputs:
- ApiEndpoint: API Gateway endpoint URL
- ApiId: API Gateway ID

Dependencies: Cần tất cả stacks trước (Cognito, Database, Storage, CDN)
"""

from aws_cdk import (
    Stack,
    aws_apigatewayv2 as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    CfnOutput
)
from constructs import Construct


class ApiStack(Stack):
    """Stack for API Gateway and Lambda functions"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        user_pool: cognito.IUserPool = None,
        table: dynamodb.ITable = None,
        bucket: s3.IBucket = None,
        distribution: cloudfront.IDistribution = None,
        cloudfront_key_pair_id: str = None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Implement API Gateway and Lambda functions in Tasks 6-16
        # This is a placeholder for the stack structure
        
        # Placeholder properties (will be implemented in Tasks 6-16)
        self.api = None
        self.lambda_functions = []
        
        # Outputs
        CfnOutput(
            self,
            "ApiEndpoint",
            value="TODO-TASKS-6-16",
            description="API Gateway endpoint URL",
            export_name=f"{construct_id}-Api-Endpoint"
        )
        
        CfnOutput(
            self,
            "ApiId",
            value="TODO-TASKS-6-16",
            description="API Gateway ID",
            export_name=f"{construct_id}-Api-Id"
        )

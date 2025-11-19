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
    aws_apigatewayv2_integrations as integrations,
    aws_lambda as _lambda,
    CfnOutput,
)
from constructs import Construct


class ApiStack(Stack):
    """Stack for HTTP API Gateway + Lambda routes"""

    def __init__(self, scope: Construct, construct_id: str, *, env=None, **kwargs) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)

        # 1) Lambda cho createUploadUrl
        create_upload_fn = _lambda.Function(
            self,
            "CreateUploadUrlFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",            # file.handler
            code=_lambda.Code.from_asset("lambda/create_upload_url"),
        )

        # 2) HTTP API
        http_api = apigw.HttpApi(
            self,
            "OnlineLibraryHttpApi",
            api_name="OnlineLibraryApi",
        )

        # 3) Route: POST /books/upload-url → Lambda
        http_api.add_routes(
            path="/books/upload-url",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration(
                "CreateUploadUrlIntegration",
                handler=create_upload_fn,
            ),
        )

        # 4) Output endpoint cho FE/console
        CfnOutput(
            self,
            "HttpApiUrl",
            value=http_api.api_endpoint,
            description="Base URL for HTTP API",
            export_name=f"{construct_id}-HttpApi-Url",
        )

        # expose cho stack khác nếu cần
        self.http_api = http_api
        self.create_upload_fn = create_upload_fn

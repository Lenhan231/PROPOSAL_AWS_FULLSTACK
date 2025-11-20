from aws_cdk import (
    Stack,
    aws_apigatewayv2 as apigw,
    aws_apigatewayv2_integrations as integrations,
    aws_apigatewayv2_authorizers as authorizers,
    aws_lambda as _lambda,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct


class ApiStack(Stack):
    """Stack for API Gateway and Lambda functions"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        cognito_stack=None,
        database_stack=None,
        storage_stack=None,
        cdn_stack=None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        user_pool = cognito_stack.user_pool if cognito_stack else None
        books_table = database_stack.table if database_stack else None
        uploads_bucket = storage_stack.bucket if storage_stack else None
        cloudfront_domain = cdn_stack.distribution_domain if cdn_stack else "d123456.cloudfront.net"

        # HTTP API with CORS
        http_api = apigw.HttpApi(
            self,
            "OnlineLibraryHttpApi",
            api_name="OnlineLibraryApi",
            cors_preflight=apigw.CorsPreflightOptions(
                allow_methods=[
                    apigw.CorsHttpMethod.GET,
                    apigw.CorsHttpMethod.POST,
                    apigw.CorsHttpMethod.PUT,
                    apigw.CorsHttpMethod.DELETE,
                ],
                allow_origins=["*"],
                allow_headers=["Content-Type", "Authorization"],
                max_age=Duration.hours(1),
            ),
        )

        # JWT Authorizer with Cognito at API Gateway level
        jwt_authorizer = None
        if user_pool and cognito_stack:
            # Create JWT authorizer using Cognito User Pool
            jwt_authorizer = authorizers.HttpJwtAuthorizer(
                id="CognitoAuthorizer",
                jwt_issuer=f"https://cognito-idp.{self.region}.amazonaws.com/{user_pool.user_pool_id}",
                jwt_audience=[cognito_stack.user_pool_client.user_pool_client_id],
            )

        # Lambda functions
        lambdas = {}

        # createUploadUrl Lambda
        create_upload_url_fn = _lambda.Function(
            self,
            "CreateUploadUrlFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="create_upload_url.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "UPLOADS_BUCKET_NAME": uploads_bucket.bucket_name if uploads_bucket else "uploads",
                "UPLOAD_URL_TTL_SECONDS": "900",
                "MAX_FILE_SIZE_BYTES": str(50 * 1024 * 1024),
                "ALLOWED_EXTENSIONS": ".pdf,.epub",
            },
        )
        lambdas["createUploadUrl"] = create_upload_url_fn

        # Grant permissions
        if books_table:
            books_table.grant_write_data(create_upload_url_fn)
        if uploads_bucket:
            uploads_bucket.grant_put(create_upload_url_fn)

        # getReadUrl Lambda
        get_read_url_fn = _lambda.Function(
            self,
            "GetReadUrlFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_read_url.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "CLOUDFRONT_DOMAIN": cloudfront_domain,
                "CLOUDFRONT_KEY_PAIR_ID": "APKAJTEST",  # TODO: Set from AWS CloudFront console
                "CLOUDFRONT_PRIVATE_KEY": "test-key",  # TODO: Set from AWS Secrets Manager
                "READ_URL_TTL_SECONDS": "3600",
            },
        )
        lambdas["getReadUrl"] = get_read_url_fn

        # Grant permissions
        if books_table:
            books_table.grant_read_data(get_read_url_fn)

        # Routes
        routes = [
            ("/books/upload-url", apigw.HttpMethod.POST, create_upload_url_fn),
            ("/books/{bookId}/read-url", apigw.HttpMethod.GET, get_read_url_fn),
            ("/books/search", apigw.HttpMethod.GET, None),  # TODO
            ("/books/my-uploads", apigw.HttpMethod.GET, None),  # TODO
            ("/admin/books/pending", apigw.HttpMethod.GET, None),  # TODO
            ("/admin/books/{bookId}/approve", apigw.HttpMethod.POST, None),  # TODO
            ("/admin/books/{bookId}/reject", apigw.HttpMethod.POST, None),  # TODO
        ]

        for path, method, handler_fn in routes:
            if handler_fn:
                http_api.add_routes(
                    path=path,
                    methods=[method],
                    integration=integrations.HttpLambdaIntegration(
                        f"{path.replace('/', '-')}-integration",
                        handler=handler_fn,
                    ),
                    authorizer=jwt_authorizer if jwt_authorizer else None,
                )

        CfnOutput(
            self,
            "HttpApiUrl",
            value=http_api.api_endpoint,
            description="Base URL for HTTP API",
            export_name=f"{construct_id}-HttpApi-Url",
        )

        # Lambda outputs
        for name, fn in lambdas.items():
            CfnOutput(
                self,
                f"{name}FunctionArn",
                value=fn.function_arn,
                description=f"{name} Lambda function ARN",
                export_name=f"{construct_id}-{name}-Arn",
            )

        self.http_api = http_api
        self.lambdas = lambdas

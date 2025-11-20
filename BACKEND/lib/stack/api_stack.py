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
        cf_key_pair_id = cdn_stack.cf_key_pair_id if cdn_stack else "APKAJTEST"
        cf_private_key_secret = cdn_stack.cf_private_key_secret if cdn_stack else None

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

        # JWT Authorizer with Cognito
        # Note: API Gateway HTTP API will validate JWT from Cognito
        # Lambda handlers extract claims from event.requestContext.authorizer.jwt.claims
        jwt_authorizer = None
        if user_pool and cognito_stack:
            # For now, routes don't require authorizer at API Gateway level
            # JWT validation happens in Lambda handlers
            pass

        # Lambda functions
        lambdas = {}

        # createUploadUrl Lambda
        create_upload_url_fn = _lambda.Function(
            self,
            "CreateUploadUrlFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("./lambda/create_upload_url"),
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
            handler="handler.handler",
            code=_lambda.Code.from_asset("./lambda/get_read_url"),
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "CLOUDFRONT_DOMAIN": cloudfront_domain,
                "CLOUDFRONT_KEY_PAIR_ID": cf_key_pair_id,
                "CLOUDFRONT_PRIVATE_KEY_SECRET_ARN": cf_private_key_secret.secret_arn if cf_private_key_secret else "",
                "READ_URL_TTL_SECONDS": "3600",
            },
        )
        lambdas["getReadUrl"] = get_read_url_fn

        # Grant permissions
        if books_table:
            books_table.grant_read_data(get_read_url_fn)
        if cf_private_key_secret:
            cf_private_key_secret.grant_read(get_read_url_fn)

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
                    authorizer=jwt_authorizer,
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

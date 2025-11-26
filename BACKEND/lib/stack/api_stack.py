import json

from aws_cdk import (
    Stack,
    aws_apigatewayv2 as apigw,
    aws_apigatewayv2_integrations as integrations,
    aws_apigatewayv2_authorizers as authorizers,
    aws_lambda as _lambda,
    aws_iam as iam,
    aws_secretsmanager as secrets,
    aws_ssm as ssm,
    aws_s3 as s3,
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

        # === Create Secrets for CloudFront ===
        # Get CloudFront credentials from context (cdk deploy -c cloudfront_key_pair_id=... -c cloudfront_private_key=...)
        cloudfront_key_pair_id = self.node.try_get_context("cloudfront_key_pair_id")
        cloudfront_private_key = self.node.try_get_context("cloudfront_private_key")

        # Only create secret if credentials provided
        cloudfront_secret = None
        if cloudfront_key_pair_id and cloudfront_private_key:
            cloudfront_secret = secrets.Secret(
                self,
                "CloudFrontSecret",
                secret_name=f"{construct_id}/cloudfront-keypair",
                description="CloudFront key pair for signed URLs",
                secret_string_value=secrets.SecretValue.unsafe_plain_text(
                    json.dumps({
                        "keyPairId": cloudfront_key_pair_id,
                        "privateKey": cloudfront_private_key,
                    })
                ),
            )

        # Store CloudFront domain in Parameter Store
        cloudfront_domain_param = ssm.StringParameter(
            self,
            "CloudFrontDomainParam",
            parameter_name=f"/{construct_id}/cloudfront-domain",
            string_value=cloudfront_domain,
            description="CloudFront distribution domain",
        )

        # getReadUrl Lambda
        get_read_url_env = {
            "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
            "CLOUDFRONT_DOMAIN_PARAM": cloudfront_domain_param.parameter_name,
            "READ_URL_TTL_SECONDS": "3600",
        }
        
        # Add secret ARN only if CloudFront credentials provided
        if cloudfront_secret:
            get_read_url_env["CLOUDFRONT_SECRET_ARN"] = cloudfront_secret.secret_arn

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
            environment=get_read_url_env,
        )
        lambdas["getReadUrl"] = get_read_url_fn

        # Grant permissions
        if books_table:
            books_table.grant_read_data(get_read_url_fn)
        
        # Grant access to parameters
        cloudfront_domain_param.grant_read(get_read_url_fn)
        
        # Grant access to secrets if provided
        if cloudfront_secret:
            cloudfront_secret.grant_read(get_read_url_fn)

        # validateMimeType Lambda (S3 event trigger)
        validate_mime_type_fn = _lambda.Function(
            self,
            "ValidateMimeTypeFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="validate_mime_type.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(60),
            memory_size=512,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "UPLOADS_BUCKET_NAME": uploads_bucket.bucket_name if uploads_bucket else "uploads",
                "ALLOWED_MIME_TYPES": "application/pdf,application/epub+zip",
            },
        )
        lambdas["validateMimeType"] = validate_mime_type_fn

        # Grant permissions
        if books_table:
            books_table.grant_write_data(validate_mime_type_fn)
        if uploads_bucket:
            uploads_bucket.grant_read_write(validate_mime_type_fn)

        # Note: S3 event notification will be added in StorageStack
        # to avoid cyclic dependency between Storage and API stacks

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

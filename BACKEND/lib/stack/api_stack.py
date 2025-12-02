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
            "CLOUDFRONT_DOMAIN": cloudfront_domain,
        }
        
        # Add CloudFront credentials if provided
        if cloudfront_key_pair_id:
            get_read_url_env["CLOUDFRONT_KEY_PAIR_ID"] = cloudfront_key_pair_id
        if cloudfront_private_key:
            # Encode private key as base64 for environment variable
            import base64
            get_read_url_env["CLOUDFRONT_PRIVATE_KEY"] = base64.b64encode(
                cloudfront_private_key.encode()
            ).decode()

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

        # searchBooks Lambda
        search_books_fn = _lambda.Function(
            self,
            "SearchBooksFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="search_books.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
            },
        )
        lambdas["searchBooks"] = search_books_fn

        # Grant permissions
        if books_table:
            books_table.grant_read_data(search_books_fn)

        # getMyUploads Lambda
        get_my_uploads_fn = _lambda.Function(
            self,
            "GetMyUploadsFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_my_uploads.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
            },
        )
        lambdas["getMyUploads"] = get_my_uploads_fn

        if books_table:
            books_table.grant_read_data(get_my_uploads_fn)

        # deleteBook Lambda
        delete_book_fn = _lambda.Function(
            self,
            "DeleteBookFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="delete_book.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "UPLOADS_BUCKET_NAME": uploads_bucket.bucket_name if uploads_bucket else "uploads",
            },
        )
        lambdas["deleteBook"] = delete_book_fn

        if books_table:
            books_table.grant_read_write_data(delete_book_fn)
        if uploads_bucket:
            uploads_bucket.grant_read_write(delete_book_fn)

        # listPendingBooks Lambda
        list_pending_books_fn = _lambda.Function(
            self,
            "ListPendingBooksFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="list_pending_books.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
            },
        )
        lambdas["listPendingBooks"] = list_pending_books_fn

        # Grant permissions
        if books_table:
            books_table.grant_read_data(list_pending_books_fn)

        # approveBook Lambda
        approve_book_fn = _lambda.Function(
            self,
            "ApproveBookFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="approve_book.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "UPLOADS_BUCKET_NAME": uploads_bucket.bucket_name if uploads_bucket else "uploads",
            },
        )
        lambdas["approveBook"] = approve_book_fn

        # Grant permissions
        if books_table:
            books_table.grant_read_write_data(approve_book_fn)
        if uploads_bucket:
            uploads_bucket.grant_read_write(approve_book_fn)

        # rejectBook Lambda
        reject_book_fn = _lambda.Function(
            self,
            "RejectBookFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="reject_book.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BOOKS_TABLE_NAME": books_table.table_name if books_table else "OnlineLibrary",
                "UPLOADS_BUCKET_NAME": uploads_bucket.bucket_name if uploads_bucket else "uploads",
            },
        )
        lambdas["rejectBook"] = reject_book_fn

        if books_table:
            books_table.grant_read_write_data(reject_book_fn)
        if uploads_bucket:
            uploads_bucket.grant_read_write(reject_book_fn)

        # updateUserProfile Lambda
        user_profile_table_name = (
            database_stack.user_profile_table.table_name
            if database_stack and hasattr(database_stack, "user_profile_table")
            else "UserProfile"
        )

        update_user_profile_fn = _lambda.Function(
            self,
            "UpdateUserProfileFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="update_user_profile.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "USER_PROFILE_TABLE": user_profile_table_name,
            },
        )
        lambdas["updateUserProfile"] = update_user_profile_fn

        get_user_profile_fn = _lambda.Function(
            self,
            "GetUserProfileFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_user_profile.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "USER_PROFILE_TABLE": user_profile_table_name,
            },
        )
        lambdas["getUserProfile"] = get_user_profile_fn

        # Grant permissions to UserProfile table
        if database_stack and hasattr(database_stack, "user_profile_table"):
            database_stack.user_profile_table.grant_read_write_data(update_user_profile_fn)
            database_stack.user_profile_table.grant_read_data(get_user_profile_fn)
    
        # Note: validate_mime_type Lambda moved to ProcessingStack
        # to avoid cyclic dependencies with S3 event notifications

        # Routes
        routes = [
            ("/books/upload-url", apigw.HttpMethod.POST, create_upload_url_fn),
            ("/books/{bookId}/read-url", apigw.HttpMethod.GET, get_read_url_fn),
            ("/books/search", apigw.HttpMethod.GET, search_books_fn),
            ("/books/my-uploads", apigw.HttpMethod.GET, get_my_uploads_fn),
            ("/books/{bookId}", apigw.HttpMethod.DELETE, delete_book_fn),
            ("/admin/books/pending", apigw.HttpMethod.GET, list_pending_books_fn),
            ("/admin/books/{bookId}/approve", apigw.HttpMethod.POST, approve_book_fn),
            ("/admin/books/{bookId}/reject", apigw.HttpMethod.POST, reject_book_fn),
            ("/user/profile", apigw.HttpMethod.PUT, update_user_profile_fn),
            ("/user/profile", apigw.HttpMethod.GET, get_user_profile_fn),
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

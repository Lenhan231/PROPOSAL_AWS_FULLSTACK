"""
Phase 1 - Task #2: CognitoStack

Mục đích: Xác thực người dùng + phân quyền Admin

Components:
- User Pool: Email login + email verification
- Password policy: min 8 chars, uppercase, lowercase, number, special char
- User Pool Client: Không secret (cho frontend)
- Admin Group: "Admins" group cho admin users

Outputs:
- UserPoolId: ID của Cognito User Pool
- UserPoolArn: ARN của User Pool
- UserPoolClientId: Client ID cho frontend authentication

Dependencies: Không phụ thuộc stack khác → Làm đầu tiên
"""

from aws_cdk import (
    Stack,
    aws_cognito as cognito,
    aws_lambda as _lambda,
    CfnOutput,
    RemovalPolicy
)
from constructs import Construct
from aws_cdk import Duration

class CognitoStack(Stack):
    """Stack for Cognito User Pool and authentication"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # This is a placeholder for the stack structure
        user_pool = cognito.UserPool(
            self,
            "UserPool",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
        )

        # User Pool Client (for frontend)
        user_pool_client = user_pool.add_client(
            "UserPoolClient",
            auth_flows=cognito.AuthFlow(
                user_password=True,      # Cho phép username/password auth
                user_srp=True,           # Secure Remote Password protocol
                admin_user_password=True,  # Allow ADMIN_NO_SRP_AUTH for testing
            ),
            generate_secret=False,       # Public client (frontend không cần secret)
            id_token_validity=Duration.hours(1),
            access_token_validity=Duration.hours(1),
            refresh_token_validity=Duration.days(30),
            read_attributes=cognito.ClientAttributes()
                .with_standard_attributes(email=True, email_verified=True),
            write_attributes=cognito.ClientAttributes() 
                .with_standard_attributes(email=True),

        )

        # Pre Token Generation trigger to inject cognito:groups into tokens
        pre_token_fn = _lambda.Function(
            self,
            "PreTokenGenerationFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="cognito_pre_token.handler.handler",
            code=_lambda.Code.from_asset(
                "./lambda",
                exclude=["**/__pycache__", "*.pyc", ".pytest_cache", "tests"],
            ),
            timeout=Duration.seconds(10),
            memory_size=128,
        )
        user_pool.add_trigger(
            cognito.UserPoolOperation.PRE_TOKEN_GENERATION,
            pre_token_fn,
        )

        # Admin Group
        admin_group = cognito.CfnUserPoolGroup(
            self,
            "AdminGroup",
            user_pool_id=user_pool.user_pool_id,
            group_name="Admins",
            description="Administrator users with full access",
        )

        # Properties for other stacks to reference
        self.user_pool = user_pool
        self.user_pool_client = user_pool_client
        self.admin_group = admin_group

        # Outputs
        CfnOutput(
            self,
            "UserPoolId",
            value=user_pool.user_pool_id,
            description="Cognito User Pool ID",
            export_name=f"{construct_id}-UserPool-Id"
        )
        
        CfnOutput(
            self,
            "UserPoolArn",
            value=user_pool.user_pool_arn,
            description="Cognito User Pool ARN",
            export_name=f"{construct_id}-UserPool-Arn"
        )
        
        CfnOutput(
            self,
            "UserPoolClientId",
            value=user_pool_client.user_pool_client_id,
            description="Cognito User Pool Client ID for frontend",
            export_name=f"{construct_id}-UserPoolClient-Id"
        )

        self.cognito = cognito

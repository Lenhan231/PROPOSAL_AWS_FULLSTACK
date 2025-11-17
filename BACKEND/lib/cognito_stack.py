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
    CfnOutput,
    RemovalPolicy
)
from constructs import Construct


class CognitoStack(Stack):
    """Stack for Cognito User Pool and authentication"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Implement Cognito User Pool 
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
        # Placeholder property (will be implemented in Task 2)
        self.user_pool = None
        
        # Outputs
        CfnOutput(
            self,
            "UserPoolId",
            value="TODO-TASK-2",
            description="Cognito User Pool ID",
            export_name=f"{construct_id}-UserPool-Id"
        )
        
        CfnOutput(
            self,
            "UserPoolArn",
            value="TODO-TASK-2",
            description="Cognito User Pool ARN",
            export_name=f"{construct_id}-UserPool-Arn"
        )
        
        CfnOutput(
            self,
            "UserPoolClientId",
            value="TODO-TASK-2",
            description="Cognito User Pool Client ID for frontend",
            export_name=f"{construct_id}-UserPoolClient-Id"
        )
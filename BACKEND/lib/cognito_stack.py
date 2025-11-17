"""
Cognito Stack - User authentication and authorization

This stack creates:
- Cognito User Pool for user management
- User Pool Client for frontend authentication  
- Admin user group
- Password policy: min 8 chars, uppercase, lowercase, number, special char
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
        # Placeholder property (will be implemented )
        self.user_pool = None
        
        # Placeholder outputs
        CfnOutput(
            self,
            "UserPoolIdPlaceholder",
            value="TODO",
            description="Cognito User Pool ID (to be implemented)"
        )
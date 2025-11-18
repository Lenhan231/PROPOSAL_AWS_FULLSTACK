"""
Phase 1 - Task #3: DatabaseStack

Mục đích: Lưu trữ tất cả metadata của sách & trạng thái upload

Components:
- DynamoDB Table: Single-table design với PK/SK
- 6 GSI (Global Secondary Indexes):
  * GSI1: Title search
  * GSI2: Author search
  * GSI3: Email lookup
  * GSI5: Status-based pending list (admin)
  * GSI6: Uploader-based my uploads (user)
  * GSI4: Reserved cho future Shelves/Favorites
- TTL: Auto-cleanup orphaned records sau 72h
- Billing: On-Demand (PAY_PER_REQUEST)

Outputs:
- TableName: Tên của DynamoDB table
- TableArn: ARN của table

Dependencies: Không phụ thuộc Cognito → Có thể làm song song, 
              nhưng nên làm sau Cognito để thống nhất naming
"""

from aws_cdk import (
    Stack,
    aws_dynamodb as dynamodb,
    CfnOutput,
    RemovalPolicy
)
from constructs import Construct


class DatabaseStack(Stack):
    """Stack for DynamoDB table"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Implement DynamoDB table in Task 3
        # This is a placeholder for the stack structure
        
        # Placeholder property (will be implemented in Task 3)
        self.table = None
        
        # Outputs
        CfnOutput(
            self,
            "TableName",
            value="TODO-TASK-3",
            description="DynamoDB table name",
            export_name=f"{construct_id}-Table-Name"
        )
        
        CfnOutput(
            self,
            "TableArn",
            value="TODO-TASK-3",
            description="DynamoDB table ARN",
            export_name=f"{construct_id}-Table-Arn"
        )

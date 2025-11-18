"""
Phase 1 - Task #5: CdnStack

Mục đích: Cho phép FE đọc file sách qua CloudFront (tối ưu + bảo mật)

Components:
- CloudFront Distribution
- Origin Access Control (OAC): Chặn direct public S3 access
- Cache Behavior: Optimize cho public/books/* path
- Signed URLs: Key pair cho secure access (TTL 1 hour)

Outputs:
- DistributionDomain: CloudFront domain name
- DistributionId: Distribution ID
- KeyPairId: Key pair ID cho Signed URLs

Dependencies: Cần bucket từ StorageStack → Làm sau StorageStack
"""

from aws_cdk import (
    Stack,
    aws_cloudfront as cloudfront,
    aws_s3 as s3,
    CfnOutput
)
from constructs import Construct


class CdnStack(Stack):
    """Stack for CloudFront distribution"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        bucket: s3.IBucket = None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Implement CloudFront distribution in Task 5
        # This is a placeholder for the stack structure
        
        # Placeholder properties (will be implemented in Task 5)
        self.distribution = None
        self.key_pair_id = "TODO-TASK-5"
        
        # Outputs
        CfnOutput(
            self,
            "DistributionDomain",
            value="TODO-TASK-5",
            description="CloudFront distribution domain name",
            export_name=f"{construct_id}-Distribution-Domain"
        )
        
        CfnOutput(
            self,
            "DistributionId",
            value="TODO-TASK-5",
            description="CloudFront distribution ID",
            export_name=f"{construct_id}-Distribution-Id"
        )
        
        CfnOutput(
            self,
            "KeyPairId",
            value="TODO-TASK-5",
            description="CloudFront key pair ID for Signed URLs",
            export_name=f"{construct_id}-KeyPair-Id"
        )

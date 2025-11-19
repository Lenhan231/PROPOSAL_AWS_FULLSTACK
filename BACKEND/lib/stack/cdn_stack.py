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
    aws_cloudfront_origins as origins,
    aws_s3 as s3,
    CfnOutput,
    Duration,
)
from constructs import Construct


class CdnStack(Stack):
    """Stack for CloudFront distribution"""

    def __init__(self, scope: Construct, construct_id: str, storage_stack,**kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Create CloudFront distribution
        distribution = cloudfront.Distribution(
            self,
            "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(
                    storage_stack.bucket,
                    origin_access_identity=cloudfront.OriginAccessIdentity(
                        self,
                        "OAC",
                    ),
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
        )

        
        # Outputs
        CfnOutput(
            self,
            "DistributionDomain",
            value=distribution.domain_name,
            description="CloudFront distribution domain name",
            export_name=f"{construct_id}-Distribution-Domain",
        )

        CfnOutput(
            self,
            "DistributionId",
            value=distribution.distribution_id,
            description="CloudFront distribution ID",
            export_name=f"{construct_id}-Distribution-Id",
        )

        # Property for other stacks
        self.distribution = distribution

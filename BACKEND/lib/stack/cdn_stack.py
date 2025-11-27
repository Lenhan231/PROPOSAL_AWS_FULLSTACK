from aws_cdk import (
    Stack,
    aws_cloudfront as cloudfront,
    aws_s3 as s3,
    CfnOutput,
    Fn,
)
from constructs import Construct


class CdnStack(Stack):
    """Stack for CloudFront distribution"""

    def __init__(self, scope: Construct, construct_id: str, bucket_name=None, storage_stack_name=None, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Get bucket name from CloudFormation export if not provided
        if not bucket_name and storage_stack_name:
            bucket_name = Fn.import_value(f"{storage_stack_name}-Bucket-Name")
        
        # Import existing bucket by name to avoid cyclic dependency
        bucket = s3.Bucket.from_bucket_name(self, "S3Bucket", bucket_name) if bucket_name else None

        # 1) OAC for CloudFront -> S3
        oac = cloudfront.CfnOriginAccessControl(
            self,
            "OAC",
            origin_access_control_config=cloudfront.CfnOriginAccessControl.OriginAccessControlConfigProperty(
                name="OnlineLibraryOAC",
                origin_access_control_origin_type="s3",
                signing_behavior="always",
                signing_protocol="sigv4",
            )
        )

        # 2) CloudFront Distribution (L1 vì cần OAC)
        distribution = cloudfront.CfnDistribution(
            self,
            "Distribution",
            distribution_config=cloudfront.CfnDistribution.DistributionConfigProperty(
                enabled=True,
                default_root_object="",
                origins=[
                    cloudfront.CfnDistribution.OriginProperty(
                        id="S3Origin",
                        domain_name=bucket.bucket_regional_domain_name,
                        origin_access_control_id=oac.attr_id,
                        s3_origin_config=cloudfront.CfnDistribution.S3OriginConfigProperty(
                            origin_access_identity=""
                        )
                    )
                ],
                default_cache_behavior=cloudfront.CfnDistribution.DefaultCacheBehaviorProperty(
                    target_origin_id="S3Origin",
                    viewer_protocol_policy="redirect-to-https",
                    forwarded_values=cloudfront.CfnDistribution.ForwardedValuesProperty(
                        query_string=False,
                        cookies=cloudfront.CfnDistribution.CookiesProperty(forward="none"),
                    ),
                )
            )
        )

        # 3) Output
        CfnOutput(
            self,
            "DistributionDomain",
            value=distribution.attr_domain_name,
            export_name=f"{construct_id}-Distribution-Domain",
        )
        CfnOutput(
            self,
            "DistributionId",
            value=distribution.ref,
            export_name=f"{construct_id}-Distribution-Id",
        )
        CfnOutput(
            self,
            "OACId",
            value=oac.attr_id,
            export_name=f"{construct_id}-OAC-Id",
        )

        # Export for other stacks
        self.distribution = distribution
        self.distribution_domain = distribution.attr_domain_name
        self.oac_id = oac.attr_id

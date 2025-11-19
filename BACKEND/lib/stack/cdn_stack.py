from aws_cdk import (
    Stack,
    aws_cloudfront as cloudfront,
    aws_s3 as s3,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct


class CdnStack(Stack):
    """Stack for CloudFront distribution"""

    def __init__(self, scope: Construct, construct_id: str, storage_stack, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        bucket = storage_stack.bucket  # nhận bucket từ StorageStack

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

        # 3) Bucket policy – allow CloudFront Distribution ARN
        bucket.add_to_resource_policy(
            iam.PolicyStatement(
                actions=["s3:GetObject"],
                resources=[bucket.arn_for_objects("*")],
                principals=[iam.ServicePrincipal("cloudfront.amazonaws.com")],
            )
        )

        # 4) Output
        CfnOutput(self, "DistributionDomain", value=f"{distribution.attr_domain_name}")
        CfnOutput(self, "DistributionId", value=f"{distribution.ref}")

        # export cho stack khác nếu cần
        self.distribution = distribution

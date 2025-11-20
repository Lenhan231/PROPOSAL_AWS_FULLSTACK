from aws_cdk import (
    Stack,
    aws_cloudfront as cloudfront,
    aws_s3 as s3,
    aws_iam as iam,
    aws_secretsmanager as secrets,
    SecretValue,
    CfnOutput,
)
from constructs import Construct
import base64


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

        # 5) CloudFront Key Pair for Signed URLs
        # Create secret for CloudFront private key
        # User must manually:
        # 1. Generate key pair in AWS CloudFront console
        # 2. Store private key in this secret
        cf_key_pair_secret = secrets.Secret(
            self,
            "CloudFrontKeyPair",
            secret_name="cloudfront/key-pair",
            description="CloudFront key pair for signed URLs - populate with real key",
            secret_string_value=SecretValue.unsafe_plain_text(
                base64.b64encode(b"PLACEHOLDER_KEY_PAIR_ID").decode()
            ),
        )

        # 6) Output CloudFront credentials
        CfnOutput(
            self,
            "CloudFrontKeyPairId",
            value="PLACEHOLDER_KEY_PAIR_ID",
            description="CloudFront Key Pair ID - replace with real ID from AWS console",
            export_name=f"{construct_id}-CloudFront-KeyPairId",
        )

        CfnOutput(
            self,
            "CloudFrontPrivateKeySecret",
            value=cf_key_pair_secret.secret_arn,
            description="ARN of secret containing CloudFront private key - populate with real key",
            export_name=f"{construct_id}-CloudFront-PrivateKeySecret",
        )

        CfnOutput(
            self,
            "CloudFrontKeyPairSetupInstructions",
            value="1. Go to AWS CloudFront console > Key pairs\n2. Create new key pair\n3. Store private key in Secrets Manager secret: " + cf_key_pair_secret.secret_name,
            description="Instructions for setting up CloudFront key pair",
        )

        # Export for other stacks
        self.distribution = distribution
        self.distribution_domain = distribution.attr_domain_name
        self.cf_key_pair_id = "PLACEHOLDER_KEY_PAIR_ID"
        self.cf_private_key_secret = cf_key_pair_secret

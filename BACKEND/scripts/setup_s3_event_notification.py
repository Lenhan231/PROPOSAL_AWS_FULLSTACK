#!/usr/bin/env python3
"""
Setup S3 event notification to trigger validate_mime_type Lambda

This script creates S3 event notification configuration to trigger
the validate_mime_type Lambda function when files are uploaded to
the uploads/ prefix.

Usage:
    python3 setup_s3_event_notification.py [--region ap-southeast-1]
"""

import json
import boto3
import argparse
from typing import Optional


def get_lambda_arn(lambda_name: str, region: str) -> str:
    """Get Lambda function ARN by name"""
    lambda_client = boto3.client("lambda", region_name=region)
    try:
        response = lambda_client.get_function(FunctionName=lambda_name)
        return response["Configuration"]["FunctionArn"]
    except lambda_client.exceptions.ResourceNotFoundException:
        raise ValueError(f"Lambda function '{lambda_name}' not found in region {region}")


def get_s3_bucket_name(stack_name: str, region: str) -> str:
    """Get S3 bucket name from CloudFormation stack"""
    cf_client = boto3.client("cloudformation", region_name=region)
    try:
        response = cf_client.describe_stacks(StackName=stack_name)
        stack = response["Stacks"][0]
        
        # Find S3 bucket output
        for output in stack.get("Outputs", []):
            output_key = output.get("OutputKey", "")
            if "BucketName" in output_key or "Bucket" in output_key:
                bucket_value = output["OutputValue"]
                # Extract bucket name if it's an ARN
                if bucket_value.startswith("arn:aws:s3:::"):
                    return bucket_value.replace("arn:aws:s3:::", "")
                return bucket_value
        
        raise ValueError(f"No S3 bucket output found in stack {stack_name}")
    except cf_client.exceptions.ClientError as e:
        raise ValueError(f"Stack '{stack_name}' not found: {str(e)}")


def grant_lambda_s3_permission(lambda_name: str, bucket_name: str, region: str) -> None:
    """Grant S3 permissions to Lambda"""
    lambda_client = boto3.client("lambda", region_name=region)
    iam_client = boto3.client("iam", region_name=region)
    
    # Remove existing permission first
    try:
        lambda_client.remove_permission(
            FunctionName=lambda_name,
            StatementId="AllowS3Invoke",
        )
    except lambda_client.exceptions.ResourceNotFoundException:
        pass
    
    try:
        lambda_client.add_permission(
            FunctionName=lambda_name,
            StatementId="AllowS3Invoke",
            Action="lambda:InvokeFunction",
            Principal="s3.amazonaws.com",
            SourceArn=f"arn:aws:s3:::{bucket_name}",
        )
        print(f"✅ Granted S3 invoke permission to Lambda {lambda_name}")
    except Exception as e:
        print(f"⚠️  Error granting invoke permission: {str(e)}")
    
    # Grant S3 read/write permissions via IAM policy
    try:
        # Get Lambda role
        response = lambda_client.get_function(FunctionName=lambda_name)
        role_arn = response["Configuration"]["Role"]
        role_name = role_arn.split("/")[-1]
        
        # Create inline policy for S3 access
        policy_document = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:DeleteObject",
                    ],
                    "Resource": f"arn:aws:s3:::{bucket_name}/*",
                }
            ],
        }
        
        # Use IAM client without region
        iam_client_global = boto3.client("iam")
        iam_client_global.put_role_policy(
            RoleName=role_name,
            PolicyName="S3Access",
            PolicyDocument=json.dumps(policy_document),
        )
        print(f"✅ Granted S3 read/write permissions to Lambda role {role_name}")
    except Exception as e:
        print(f"⚠️  Error granting S3 permissions: {str(e)}")


def setup_s3_event_notification(
    bucket_name: str,
    lambda_arn: str,
    region: str,
    prefix: str = "uploads/",
) -> None:
    """Setup S3 event notification"""
    s3_client = boto3.client("s3", region_name=region)
    
    notification_config = {
        "LambdaFunctionConfigurations": [
            {
                "LambdaFunctionArn": lambda_arn,
                "Events": ["s3:ObjectCreated:*"],
                "Filter": {
                    "Key": {
                        "FilterRules": [
                            {
                                "Name": "prefix",
                                "Value": prefix,
                            }
                        ]
                    }
                },
            }
        ]
    }
    
    try:
        s3_client.put_bucket_notification_configuration(
            Bucket=bucket_name,
            NotificationConfiguration=notification_config,
        )
        print(f"✅ S3 event notification configured")
        print(f"   Bucket: {bucket_name}")
        print(f"   Prefix: {prefix}")
        print(f"   Lambda: {lambda_arn}")
    except Exception as e:
        raise ValueError(f"Failed to setup S3 event notification: {str(e)}")


def main():
    parser = argparse.ArgumentParser(
        description="Setup S3 event notification for validate_mime_type Lambda"
    )
    parser.add_argument(
        "--region",
        default="ap-southeast-1",
        help="AWS region (default: ap-southeast-1)",
    )
    parser.add_argument(
        "--env",
        default="dev",
        help="Environment name (default: dev)",
    )
    parser.add_argument(
        "--prefix",
        default="uploads/",
        help="S3 prefix to trigger Lambda (default: uploads/)",
    )
    
    args = parser.parse_args()
    
    try:
        # Construct stack names
        stack_prefix = f"OnlineLibrary-{args.env}"
        storage_stack_name = f"{stack_prefix}-Storage"
        processing_stack_name = f"{stack_prefix}-Processing"
        
        print(f"🔧 Setting up S3 event notification...")
        print(f"   Region: {args.region}")
        print(f"   Environment: {args.env}")
        print()
        
        # Get S3 bucket name
        print(f"📦 Getting S3 bucket from {storage_stack_name}...")
        bucket_name = get_s3_bucket_name(storage_stack_name, args.region)
        print(f"✅ Bucket: {bucket_name}")
        print()
        
        # Get Lambda function name from ProcessingStack outputs
        print(f"🔍 Getting Lambda function from {processing_stack_name}...")
        cf_client = boto3.client("cloudformation", region_name=args.region)
        response = cf_client.describe_stacks(StackName=processing_stack_name)
        stack = response["Stacks"][0]
        
        lambda_name = None
        for output in stack.get("Outputs", []):
            if "ValidateMimeTypeFnName" in output.get("OutputKey", ""):
                lambda_name = output["OutputValue"]
                break
        
        if not lambda_name:
            raise ValueError(f"Lambda function name not found in {processing_stack_name}")
        
        print(f"✅ Lambda: {lambda_name}")
        print()
        
        # Get Lambda ARN
        lambda_arn = get_lambda_arn(lambda_name, args.region)
        print(f"✅ Lambda ARN: {lambda_arn}")
        print()
        
        # Grant S3 permission
        print(f"🔐 Granting S3 permission to Lambda...")
        grant_lambda_s3_permission(lambda_name, bucket_name, args.region)
        print()
        
        # Setup S3 event notification
        print(f"⚙️  Setting up S3 event notification...")
        setup_s3_event_notification(bucket_name, lambda_arn, args.region, args.prefix)
        print()
        
        print(f"✨ Done! S3 event notification is now active.")
        print(f"   Files uploaded to s3://{bucket_name}/{args.prefix}* will trigger {lambda_name}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        exit(1)


if __name__ == "__main__":
    main()

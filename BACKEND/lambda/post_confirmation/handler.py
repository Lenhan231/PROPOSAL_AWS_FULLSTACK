"""
Post Confirmation trigger - tạo UserProfile record khi user sign up
"""
import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
user_profile_table = dynamodb.Table(os.environ.get("USER_PROFILE_TABLE", "UserProfile"))


def handler(event, context):
    """
    Cognito Post Confirmation trigger
    Tạo UserProfile record sau khi user confirm email
    """
    print(f"Event: {json.dumps(event)}")

    user_id = event["request"]["userAttributes"]["sub"]
    email = event["request"]["userAttributes"]["email"]
    # Extract user_name from email (part before @)
    user_name = email.split("@")[0]

    try:
        user_profile_table.put_item(
            Item={
                "user_id": user_id,
                "email": email,
                "user_name": user_name,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        print(f"Created UserProfile for {user_id}")
    except Exception as e:
        print(f"Error creating UserProfile: {str(e)}")
        raise

    return event

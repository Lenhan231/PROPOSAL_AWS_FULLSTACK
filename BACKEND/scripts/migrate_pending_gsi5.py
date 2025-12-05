"""
Add GSI5 keys for pending books that are missing them.

Usage:
  python migrate_pending_gsi5.py --table OnlineLibrary --region ap-southeast-1

This script scans for items with status=PENDING and sets:
  GSI5PK = "STATUS#PENDING"
  GSI5SK = uploadedAt or createdAt (fallback to current timestamp)
"""

import argparse
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr


def migrate(table_name: str, region: str) -> None:
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    pending = table.scan(
        FilterExpression=Attr("status").eq("PENDING")
    ).get("Items", [])

    updated = 0
    for item in pending:
        pk = item["PK"]
        sk = item["SK"]

        if item.get("GSI5PK") and item.get("GSI5SK"):
            continue

        gsi5sk = (
            item.get("uploadedAt")
            or item.get("createdAt")
            or datetime.now(timezone.utc).isoformat()
        )

        table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression="SET GSI5PK = :gpk, GSI5SK = :gsk",
            ExpressionAttributeValues={
                ":gpk": "STATUS#PENDING",
                ":gsk": gsi5sk,
            },
        )
        updated += 1

    print(f"Total pending items: {len(pending)}; Updated: {updated}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add GSI5 keys to pending books")
    parser.add_argument("--table", required=True, help="DynamoDB table name")
    parser.add_argument("--region", default="ap-southeast-1", help="AWS region")
    args = parser.parse_args()

    migrate(args.table, args.region)

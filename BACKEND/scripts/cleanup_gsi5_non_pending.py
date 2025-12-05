"""
Remove GSI5 keys from books that are no longer PENDING.

Usage:
  python cleanup_gsi5_non_pending.py --table OnlineLibrary --region ap-southeast-1

This scans for items where status != PENDING and GSI5PK exists, then removes
GSI5PK and GSI5SK so the item is no longer returned in the pending index.
"""

import argparse

import boto3
from boto3.dynamodb.conditions import Attr


def cleanup(table_name: str, region: str) -> None:
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    response = table.scan(
        FilterExpression=Attr("status").ne("PENDING") & Attr("GSI5PK").exists()
    )
    items = response.get("Items", [])

    print(f"Found {len(items)} non-pending items with GSI5PK to clean")

    for item in items:
        book_id = item.get("bookId") or item.get("PK", "").replace("BOOK#", "")
        status = item.get("status")
        print(f"- Cleaning book {book_id} (status={status})")
        table.update_item(
            Key={"PK": item["PK"], "SK": item["SK"]},
            UpdateExpression="REMOVE GSI5PK, GSI5SK",
        )

    print("Cleanup complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remove GSI5 keys from non-pending books")
    parser.add_argument("--table", required=True, help="DynamoDB table name")
    parser.add_argument("--region", default="ap-southeast-1", help="AWS region")
    args = parser.parse_args()
    cleanup(args.table, args.region)
